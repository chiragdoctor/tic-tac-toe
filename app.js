var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var controller = require('./app/controller');

var app = express();

var port = process.env.PORT || '3000';
app.set('port', port);

var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(port);

console.log('Tic-Tac-Toe server listening on port %d', port);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', controller.get);

app.post('/', controller.post);

var players= [];
var gameRegistrar = [];

io.on('connection', function(socket) {
    setupPlayerAndConnection(socket);
    // Updates a Players name for display across clients
    socket.on('updatePlayerName',function(nameData) {

        var player = getPlayer(socket.id);
        player.playerName=nameData.name;

        io.emit('player_update',player);

    });

    socket.on('requestComputerGame', function(data){

        // Create AI player
        var aiPlayer = new Player(data.requestID + '_AI', 'Computer', 'playing', true);
        getPlayer(data.requestID).computerai=false;
        var players = {requester:getPlayer(data.requestID),requestee:aiPlayer};

        //console.log(players);

        var game = new Game(players,data.requestID);
        game.state="live";
        gameRegistrar.push(game);
        game.players.forEach(function(player) {
            player.state="playing";
        });

        function sendRequest(gamePlaying) {
            io.emit("player_update",gamePlaying.playerX);
            gamePlaying.startGame();
        }

        sendRequest(game);


    });
});

//Game Object
function Game(playerList,id) {
    playerList.requester.icon="X";
    this.playerX=playerList.requester;

    playerList.requestee.icon="O";
    this.playerO= playerList.requestee;

    this.players=[this.playerX,this.playerO];

    this.currentPlayer=this.playerX;

    //Main Vars
    this.id=id!=null?id:this.playerX.id+GAME_CONNECTOR+this.playerO.id;
    this.board=[[0,0,0],[0,0,0],[0,0,0]];
    this.aiscore=[[0,0,0],[0,0,0],[0,0,0]];
    this.stats={x:{wins:0,losses:0,stale:0},o:{wins:0,losses:0,stale:0}};
    this.live=true;

    return this;
}

Game.prototype.startGame = function(){
   console.log('game will start now..')
}


//Gets a Player by Player.id
function getPlayer(playerId) {
    for (var i=0;i<players.length;++i) {
        if (players[i].id==playerId) {
            return players[i];
        }
    }

    console.error("Error: No Player Found for " + playerId);
}

//Player Object
function Player(clientId,userName,state,ai) {

    this.id=clientId;
    this.state=state;
    if (userName !== undefined) {
        this.playerName=userName;
    }else
    {
        this.playerName=this.id;
    }
    this.computerai=ai;
    return this;
}

function getCookieValue(request,cookie) {
    var list = {},
        rc = request.headers.cookie;
    var match="";
    rc && rc.split(';').forEach(function( cookie ) {

        var parts = cookie.split('=');

        if (parts[0].trim()=="tttGameParams") match = parts[1];

    });

    return match;
}

function extractParams(cookieParams,socketId) {
    var gameParams;
    if (cookieParams === "") {
        return {
            userName:socketId,
            sessId:socketId,
        };
    }else
    {
        var parseStr = cookieParams.split("|");
        return {
            userName:parseStr[0],
            sessId:parseStr[1],
        };

    }




}

function setupPlayerAndConnection(socket) {
    //Cookie Process for Name - Ignore Session Id since it most likely is Stale
    var cookieStr = getCookieValue(socket.request, "userinfo");
    //Load Game Params from Cookie
    var gameParams = extractParams(cookieStr, socket.id);
    //Set Player
    var player = new Player(socket.id, gameParams.userName, "new", false);
    players.push(player);
    socket.emit('available_games', players);
    io.emit('player_update', player);
}

module.exports = app;
