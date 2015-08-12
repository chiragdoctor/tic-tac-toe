var HOST = "http://localhost:3000/"
var socketId = '';

var playerInfo ={
    username: '',
    session: ''
}
var SHOW_SCORES=false;

$(document).ready(function() {
    var socket = io(HOST);
    socket.on('connect', function () {
        socketId = socket.io.engine.id;
        initGame();
        console.log("ID Assigned - " + socketId);

    });


    socket.on('begin_game', function(game){
        gameId = game.id;

        if (game.currentPlayer.id == socketId)
            updateBoard(game.board, true,game.aiscore);
        else
            updateBoard(game.board, false,game.aiscore);
        $(".header").slideUp(250);
        $(".gameIconPanel").slideDown(500);
        $(".gameViewBox").slideDown(500);
        if (game.currentPlayer.computerai) {
            var row= Math.floor(Math.random() * 3-1) + 1;
            var col= Math.floor(Math.random() * 3-1) + 1;
            var playerMoveInfo = {"gameId": game.id, "player": game.currentPlayer.id, "action": {"row": row, "quad": col}};

            socket.emit('playTurn', playerMoveInfo);
        }
    });

    socket.on('game_message', function (data) {

        logEvent(data.message,true);
    });


    function initGame(){
    var userCookie = getCookie("userinfo");
    if(userCookie != ""){

        getUserParams(userCookie)
    }
    else {
        playerInfo.username = socketId;
        playerInfo.session = socketId;
    }
    updateUsername();
    sendRequest();
    // will update the username if page refresh.
    refreshUsername();
}

function updateUsername(){
    $("#updateName").click(function(){
        var username = prompt("Add UserName", "");
        if(username != null){
            playerInfo.username = username;
            persistUser();
            $("#player-name").empty().append("Your Username: " + playerInfo.username);
            socket.emit("updatePlayerName",{"name": username});
        }
    });
}

function refreshUsername() {
    $("#player-name").empty().append("Your Username: " + playerInfo.username);
}
function sendRequest(){
    var request = {
        requestID: socketId,
        action: "Request Computer Game"

    };
    socket.emit('requestComputerGame', request);
}

function getUserParams(userParams) {
    var parseStr = userParams.split("|");
    playerInfo.username=parseStr[0];
    playerInfo.session=parseStr[1];
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toGMTString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) != -1) return c.substring(name.length, c.length);
    }
    return "";
}

function persistUser() {
    var user = playerInfo.username + '|' + playerInfo.session;
    setCookie("userinfo", user, 3);
}

function logEvent(event) {
    $('#game-message').empty().append(event);
}

socket.on('player_update', function (player) {
    logEvent("Player " + player.playerName+ " Info Updated");
});


function selectionSetup(selection) {
    return function () {
        showSelection(selection);
    }
}


function showSelection(selection) {
    $(selection).toggleClass("selecting");
}

function playSetup(row, quad) {
    return function () {
        playTurn(row, quad);
    }
}

function playTurn(row, quad) {

    var playerInfo = {"gameId": gameId, "player": socketId, "action": {"row": row, "quad": quad}};
    $("#row" + row + "_" + quad).toggleClass("selecting");
    socket.emit('playTurn', playerInfo);

}
function updateBoard(game_data, activate,scores) {

    var newScores = scoreBoard(game_data,socketId);

    for (var i = 0; i < 3; ++i) {

        for (var r = 0; r < 3; ++r) {
            var rowindex = "#row" + i + "_" + r;

            if (game_data[i][r] == 0 && activate) {

                $(rowindex).empty();
                if (SHOW_SCORES) {
                    $(rowindex).append("<span class='scoreText'>"+newScores[i][r]+"/" +scores[i][r] + "</span>");
                }

                $(rowindex).bind('mouseenter mouseleave', selectionSetup(rowindex));
                $(rowindex).bind('click', playSetup(i, r));

            } else if (game_data[i][r] == 0 && !activate) {
                $(rowindex).empty();
                if (!SHOW_SCORES) {
                    $(rowindex).append("<span class='scoreText'>"+newScores[i][r]+"/" +scores[i][r] + "</span>");
                }
                $(rowindex).unbind();
            }
            else if (game_data[i][r] != 0) {
                $(rowindex).unbind();
                if (game_data[i][r] == socketId) {

                    $(rowindex).empty().append(playerIcon);
                } else {

                    $(rowindex).empty().append(oppPlayerIcon);
                }
            }


        }

    }
}

});
