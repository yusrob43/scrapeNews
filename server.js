var path = require('path');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

var PORT = 3000;

var exphbs = require('express-handlebars');

var hbs = exphbs.create({
  defaultLayout: 'main',
  helpers: {
    addOne: function(value, options){
      return parseInt(value) + 1;
    }
  }
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

var request = require('request');
var cheerio = require('cheerio');
var mongoose = require('mongoose');
var ObjectId = require('mongojs').ObjectID;

if (process.env.MONGODB_URI){
  mongoose.connect(process.env.MONGODB_URI);
} else{    
  mongoose.connect('mongodb://localhost/scraper');
}

var db = mongoose.connection;

db.on('error', function(err) {
  console.log('Database Error:', err);
});
var ScrapedData = require('./scrapedDataModel');

var options = {
  url: 'https://www.bodybuilding.com/fun/whats-new.html',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13'
  }
};
request(options, function(error, response, html) {
  var $ = cheerio.load(html);
  $('div.new-content-block').each(function(i, element) {
  var $a = $(this).children('a');
    var $div = $(this).children('div');
    var articleURL = $a.attr('href');
    var imgURL = $a.children('img').attr('src');
    var title = $div.children('h4').text();
    var synopsis = $div.children('p').text();

    var scrapedData = new ScrapedData({
      title: title,
      imgURL: imgURL,
      synopsis: synopsis,
      articleURL: articleURL
    });

    scrapedData.save(function(err) {
      if (err) {
        console.log(err);
      }
      console.log('Success!');
    });
  });
});

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(express.static('public'));

app.get('/', function(req, res) {
  ScrapedData
    .findOne()
    .exec(function(err,data) {
      if (err) return console.error(err);
      res.render('index', {
        imgURL: data.imgURL,
        title: data.title,
        synopsis: data.synopsis,
        _id: data._id,
        articleURL: data.articleURL,
        comments: data.comments
      });
    })
});

app.get('/next/:id', function(req, res) {
  ScrapedData
    .find({
      _id: {$gt: req.params.id}
    })
    .sort({_id: 1 })
    .limit(1)
    .exec(function(err,data) {
      if (err) return console.error(err);
      res.json(data);
    })
});

app.get('/prev/:id', function(req, res) {
  ScrapedData
    .find({
      _id: {$lt: req.params.id}
    })
    .sort({_id: -1 })
    .limit(1)
    .exec(function(err,data) {
      if (err) return console.error(err);
      res.json(data);
    })
});

app.post('/comment/:id', function(req, res) {
  ScrapedData.findByIdAndUpdate(
    req.params.id,
    {$push: {
      comments: {
        text: req.body.comment
      }
    }},
    {upsert: true, new: true},
    function(err, data) {
      if (err) return console.error(err);
      res.json(data.comments);
    }
  );
});

app.post('/remove/:id', function(req, res) {
  ScrapedData.findByIdAndUpdate(
    req.params.id,
    {$pull: {
      comments: {
        _id: req.body.id
      }
    }},
    {new: true},
    function(err, data) {
      if (err) return console.error(err);
      res.json(data.comments);
    }
  );
});

app.listen(PORT, function() {
  console.log('App running on http://localhost:' + PORT + ' ! Click to view.' );
});
