

module.exports = {
    get : function(req, res) {
        res.render('index', { title: 'Tic-Tac-Toe' });
    },
    post : function(req, res) {
        res.render('index', {title: 'Tic-Tac-Toe', name: req.body.name});
    }
};

