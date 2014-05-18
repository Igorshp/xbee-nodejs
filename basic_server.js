var util = require('util');
var XBee = require('../svd-xbee/index.js').XBee;
var xbeeapi = require('../svd-xbee/lib/xbee-api');
var packet_patterns = require('../svd-xbee/examples/nutshell/sensorData');
var Parser = require('../svd-xbee/examples/full/parser');
var JParser = require('jParser');
var jsonPacker = require('../svd-xbee/examples/nutshell/jsonPacker');
var app = require('http').createServer(handler)
	, io = require('socket.io').listen(app)
	, fs = require('fs');

var superSocket = false;
var http = require('http');
var request = require('request');

app.listen(8000);

var nodeaddr = false;

var xbee = new XBee({
  port: '/dev/ttyAMA0',   // replace with yours
  baudrate: 9600, // 9600 is default
	config: {},
	emit_buffers: true
	}).init();

xbee.on("initialized", function(params) {
		console.log("XBee Parameters: %s", util.inspect(params));
		xbee.discover(); 
		console.log("Node discovery starded...");
});


xbee.on("newNodeDiscovered", function(node){
	console.log("Node %s discovered", node.remote64.hex);
	console.log(node);
	
	if(superSocket){
		io.sockets.emit('nodes',exportNodes(xbee.nodes));
	}

	node.on('io', function(data,packet){
	});
	node.on('data', function(data,packet,thisnode){
		var type =  data[0];

		if (packet_patterns[type]){
		nodeaddr = packet.remote64.hex
		console.log(data);
		//var parser = new jParser(data, {pattern: packet_patterns[type].reading});
		//var parsed = parser.parse('pattern');
		io.sockets.emit('data',data);	
		}
		});
});


function exportData(input){
	var data = {};
	data.remote16 = input.remote16;
	data.remote64 = input.remote64;
	data.id = input.id;
	data.deviceType = input.deviceType;
	data.connnected = input.connnected;
	return data;
}
function exportNodes(nodes){
	var output = [];
	for ( var id in nodes ) {
		output.push(exportData(nodes[id]));
	};
	return output;
}

function handler(req, res){
	fs.readFile(__dirname+'/index.html',
	function(err, data) {
		if(err){
			res.writeHead(500);
			return res.end('Error loading index.html');
		}

		res.writeHead(200);
		res.end(data);
	});


}


io.sockets.on('connection', function(socket){
	superSocket = socket;
	io.sockets.emit('nodes',exportNodes(xbee.nodes));
	socket.on('command',function(data){
		if (data == 'discover'){
			xbee.discover(); 
			io.sockets.emit('logs','discovery started');
		}
	});
	socket.on('control',function(data){
	

	});
	socket.on('node_command',function(data){
		var node = data.node;
		var buff = new Buffer(1);
		buff.writeInt8(parseInt(data.command),0);
		xbee.nodes[node.remote64.hex].send(buff);
		console.log('sending '+data.command+' to '+node.remote64.hex);


	});
	socket.on('msg', function(data){
		io.sockets.emit('data', 'server received: '+data);
		var responce = new Buffer(8);
		responce.writeInt8(1,0);
		responce.writeInt8(1,1);
		responce.writeFloatLE(parseFloat(data),2);
		//xbee.broadcast(responce);
		xbee.nodes[nodeaddr].send(responce);
	});
});


