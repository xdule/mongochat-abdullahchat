const express= require('express');
const app=express();
const mongo = require('mongodb').MongoClient;
const client = require('socket.io').listen(4000).sockets;
const ejs= require('ejs');
var moment = require('moment');

var http = require('http');
var https = require('https');


var server = http.createServer(app);
server.listen(3000);
console.log('Express server started on port %s', server.address().port);

app.use('static', express.static('views'));
app.set('views', './views');

let filePath= "./views/"; 
let usertrack=[];
//  mongo connection
mongo.connect('mongodb://127.0.0.1/mongochat', function(err, db){
    if(err){
        throw err;
    }

    console.log('Chat started...');

    // Socket connectipon 
    client.on('connection', function(socket){
        let chat = db.collection('chats');
        let user = db.collection('users');

        // Create function to send status
        sendStatus = function(s){
            socket.emit('status', s);
        }

        // Get 100 chats from mongo
        chat.find().limit(100).sort({_id:1}).toArray(function(err, res){
            if(err){
                throw err;
            }

            // Emit the messages
            socket.emit('output', res);
        });

        // Handle input events
        socket.on('input', function(data){
            let name = data.name;
            let message = data.message;
            let available = true;

            // Check for name and message
            if(name == '' || message == ''){
                // Send error status
                sendStatus('Please enter a name and message');
            } else {                
                // Insert message
                chat.insert({name: name, message: message, available: available}, function(){
                    client.emit('output', [data]);
                    client.emit('updatechat');
                    
                    // Send status object
                    sendStatus({
                        message: 'Message sent',
                        name:name,
                        clear: true
                    });
                    var today = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
                    user.update({name:name},{$set: {available:available, timestamp: today}},{upsert:true});
                });

             

                
            }
        });
        let resetusers=function( p ){
            console.log("stanje u resetusers");
            console.log(usertrack);
            chat.update( { name: { $nin: usertrack } }, { $set: { available: false } } );
            console.log("end");

            client.emit('updatechat'); usertrack=[];
            
            funReset();

        };
        socket.on('availableUpdate', function(data){
            let name = data.name;            
            let available = true;
           // usertrack.push(name); 
           var today = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
           user.update({name:name},{$set: {available:available, timestamp: today}},{upsert:true});

        });
        
        socket.on('disconnect',function(data){
            let name = data.name;            
            let available = data.available;

           chat.updateOne({name},{available:available},function(err, res) {
            if (err) throw err;
       //     console.log("1 availability updated");           
          });
        });

        setInterval(function(){client.emit('updatechat'); },11000 );
       
        socket.on('switch',function(data){
            let site=data.page;
         //   console.log(site);
           
            let result="";
            if(site=='about')
            {  
            //    console.log("aaa");
                ejs.renderFile( filePath+"about.ejs", {}, {}, (err, str) => {
                    // str => Rendered HTML string
                    if (err) {
              //       console.log(err)
                    } else {
                   //  console.log(str);
                     result=str;
                    }
                   });
                   
                socket.emit('page', result);
            }
            else if(site=='home')
            {              
              //  console.log("Homeaaa");  
                ejs.renderFile( filePath+"homepage.ejs", {}, {}, (err, str) => {
                    // str => Rendered HTML string
                    if (err) {
                //     console.log(err)
                    } else {
                    // console.log(str);
                     result=str;
                    }
                   });

                socket.emit('page', result);
            }
            else if(site=='chat')
            {
                let querry=[];
                
               /* chat.find().limit(100).sort({_id:1}).toArray(function(err, res){
                    if(err){
                        throw err;
                    }

                    ejs.renderFile( filePath+"chat.ejs", {res}, {}, (erra, stra) => {
                        // str => Rendered HTML string
                        if (erra) {
                    //     console.log(erra)
                        } else {
                //         console.log(stra);
                         socket.emit('page', stra);
                         
                        }
                       });


                
                });*/
                // name: / message: / available:   
                
                chat.aggregate([
                    { $lookup:
                    {
                        from: 'users',
                        localField: 'name',
                        foreignField: 'name',
                        as: 'user'
                    }
                    }
                ]).toArray(function(err, res){
                    if(err){
                        throw err;
                    }
           
                    let avail=[];
                    
                    res.forEach(element => {
                        console.log(element);
                        /*var start_time =moment( element.user.timestamp);
                        var end_time = moment(new Date());*/
                        var start_time = moment(element.user[0].timestamp, 'YYYY-MM-DDTHH:mm:ss' );
                        var end_time = moment(new Date(),'YYYY-MM-DDTHH:mm:ss');
                       /* console.log(element.user[0].timestamp);
                        console.log(start_time);
                        console.log(end_time);
                        console.log(end_time.diff(start_time));*/
                        var y=(element.user.timestamp-new Date())/2;
                        var duration = moment.duration(end_time.diff(start_time));
                        var x = duration.asSeconds(); 
                        //less than 10 sec
                        if(x<10)
                        {
                            element.user.available=true;
                         
                        }
                        else
                        {
                            element.user.available=false;
                        }
                    });
                    
                    
                    
                    ejs.renderFile( filePath+"chat.ejs", {res}, {}, (erra, stra) => {
                        // str => Rendered HTML string
                        if (erra) {
                    //     console.log(erra)
                        } else {
                //         console.log(stra);
                         socket.emit('page', stra);
                         
                        }
                       });


                
                });
                

            }

        });

        // Handle clear
        socket.on('clear', function(data){
            // Remove all chats from collection
            user.remove({}, function(){
                // Emit cleared
                socket.emit('cleared');
              
            });
            
            chat.remove({}, function(){
                // Emit cleared
                socket.emit('cleared');
                //client.emit('updatechat');
            });
            client.emit('updatechat');
        });
    });
});

app.post('/register', function(req, res) {
    let name= req.name;
    let pw=req.pw;
    console.log(name+ " " +pw);
    mongo.connect('mongodb://127.0.0.1/mongochat', function(err, db){
    if(err){
        throw err;
    }
    let user = db.collection('users');
    var today = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
    user.update({name:name},{$set: {available:available, timestamp: today, password:pw}},{upsert:true});
    
    //res.json({ name:name});
    res.status(200);
    });
    res.status(404);
    
  });