//status-reader.js
//How to use status-reader:
//you must have a gmail account
//make a credentials.json file that contains one line formatted as follows:
//    {user: '[GMAIL_ID_GOES_HERE]', pwd: '[GMAIL_PWD_GOES_HERE]'}
//    credentials.json should be in the same directory
//run status-reader.js with node
//when someone updates their status,
//    the data will be printed to console
//    and it will be written to a text file

//warning: database implementation is pending

//included packages and startup
var express = require('express')
    , stylus = require('stylus')
    , nib = require('nib')
    , app = express()
    , io = require('socket.io');

var mongoose = require('mongoose')
    , db = mongoose.connect('mongodb://localhost/mydb')
    , Schema = mongoose.Schema;

app.configure(function() {
    app.set('views',__dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.logger('dev'));
    app.use(stylus.middleware({
        src: __dirname + '/public'
        , compile: compile
    }))
    app.use(express.static(__dirname + '/public'));
});

var server = app.listen(3000);
var sio = io.listen(server);

var xmpp = require('simple-xmpp')
    , fs = require('fs')
    , xmljson = require('libxmljs');

var Item = new Schema({
    date: String,
    from: String,
    status: String
});
var ItemModel = mongoose.model('Item', Item);
//var Item = new ItemModel();

sio.sockets.on('connection', function(socket) {
    console.log('Sockets have been turned on');
    socket.emit('establish', { hello: 'world'});
});

var vars = {}; //namespace for instance-specific variables



vars.data = fs.readFileSync('.credentials.json','ASCII'); //synchronous
vars.stream = fs.createWriteStream('outputs/output.txt'); //fs.WriteStream
vars.streamAll = fs.createWriteStream('outputs/allOutput.txt'); //fs.WriteStream
var creds = eval('('+vars.data+')');
vars.user = creds.user;
vars.pwd = creds.pwd;
start(vars.user,vars.pwd);



function start(user,pwd) {
    console.log('Connecting to ' + user);
    xmpp.connect({
        jid:        user,
        password:   pwd,
        host:       'talk.google.com',
        port:       5222
    });
}



app.get('/', function(req, res) {
    
    res.render('index', {
        title: 'nodejs',
        line: 'This is a line that will be rendered'
    });
    
    //res.sendfile(__dirname + '/views/index.jade');
});

app.get('/items', function(req, res) {

    console.log(Item.find());
});

xmpp.on('online', function() {
    console.log('Connected to ' + vars.user);

});

xmpp.on('chat', function(from,message) {
    xmpp.send(from, "Hey there, how are you?");
});

xmpp.on('error', function(err) {
    console.error(err);
});

xmpp.on('buddy',function(jid, state) {
   // console.log('%s is in %s state', jid,state);
});

xmpp.on('stanza', function(stanza) {
    vars.json = xmljson.parseXmlString(stanza);
    vars.stat = vars.json.get('//status');
    vars.show = vars.json.get('//show');
    vars.pri = vars.json.get('//priority');
    vars.pres = vars.json.get('//presence');
    vars.from = vars.pres.attr('from');

    if(vars.stat) { vars.statstr = vars.stat.text(); }
    if(vars.from) { vars.fromstr = vars.from.value(); }
    
    vars.logentry = {
        'date':     Date(),
        'from':     vars.fromstr,
        'status':   vars.statstr
    };


    vars.itemdata = {
        date: Date().toString(),
        from: vars.fromstr,
        status: vars.statstr
    }

    
    //vars.stream.write(vars.logentry + '\n');
    vars.streamAll.write(vars.json + '\n');
    console.log(vars.json);

    sio.sockets.emit('xmpp-push', vars.logentry);

    vars.item = new ItemModel(vars.itemdata);
    vars.item.save( function(error, data) {
        if(error) { console.log("BIG ERROR"); }
    });

});


function probe(user) {
    console.log("Attempting probe of " + user);
    xmpp.probe(user, function(state) {
        console.log("Probe of user "+ user + " " +state);
    });
}

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}