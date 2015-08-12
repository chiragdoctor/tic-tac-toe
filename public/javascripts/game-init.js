var HOST = "http://localhost:3000"

$(document).ready(function(){
    var socket = io(HOST);

    $("#updateName").click(function(){
        var username = prompt("Add UserName", "");
        $("#player-name").empty().append("Your Username: " + username);
    });

})