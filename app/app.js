//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    cfenv = require( 'cfenv' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    i18n = require( 'i18n' ),
    jwt = require( 'jsonwebtoken' ),
    request = require( 'request' ),
    session = require( 'express-session' ),
    app = express();
var settings = require( './settings' );
var appEnv = cfenv.getAppEnv();

var port = appEnv.port || 3000;

app.set( 'superSecret', settings.superSecret );

app.use( multer( { dest: './tmp/' } ).single( 'data' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );

app.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUnitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,  //. https で使う場合は true
    maxage: 1000 * 60 * 60   //.  60min
  }
}) );

app.all( '/*', basicAuth( function( user, pass ){
  return ( user === settings.basic_username && pass === settings.basic_password );
}));

app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/public' );
app.set( 'view engine', 'ejs' );

/* i18n */
i18n.configure({
  locales: ['en'],
  directory: __dirname + '/locales'
});
app.use( i18n.init );

app.get( '/', function( req, res ){
  if( req.session && req.session.token ){
    //. トークンをデコード
    var token = req.session.token;
    jwt.verify( token, app.get('superSecret'), function( err, user ){
      if( err ){
        res.render( 'index', { user: null } );
      }else if( user && user.id ){
        res.render( 'index', { user: user } );
      }else{
        res.render( 'index', { user: null } );
      }
    });
  }else{
    res.render( 'index', { user: null } );
  }
});

/*
app.get( '/test', function( req, res ){
  if( req.session && req.session.token ){
    //. トークンをデコード
    var token = req.session.token;
    jwt.verify( token, app.get('superSecret'), function( err, user ){
      if( err ){
        res.redirect( '/login?message=Invalid token.' );
      }else if( user && user.id ){
        res.render( 'test', { user: user } );
      }else{
        res.redirect( '/login?message=Invalid token.' );
      }
    });
  }else{
    res.redirect( '/login' );
  }
});
*/

app.get( '/admin', function( req, res ){
  if( req.session && req.session.token ){
    //. トークンをデコード
    var token = req.session.token;
    jwt.verify( token, app.get('superSecret'), function( err, user ){
      if( err ){
        res.redirect( '/' );
      }else if( user && user.id ){
        if( user.role == 0 ){
          res.render( 'admin', { user: user } );
        }else{
          res.redirect( '/' );
        }
      }else{
        res.redirect( '/' );
      }
    });
  }else{
    res.redirect( '/' );
  }
});

app.get( '/login', function( req, res ){
  var message = ( req.query.message ? req.query.message : '' );
  res.render( 'login', { message: message } );
});

app.post( '/login', function( req, res ){
  var id = req.body.id;
  var password = req.body.password;
  //console.log( 'id=' + id + ',password=' + password);

  var options1 = {
    url: settings.api_url + '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: {
      id: id,
      password: password,
    }
  };
  request( options1, ( err1, res1, body1 ) => {
    if( err1 ){
      console.log( err1 );
      res.redirect( '/?message=' + err1.message );
    }else{
      if( body1.status && body1.token ){
        req.session.token = body1.token;

        var token = req.session.token;
        jwt.verify( token, app.get('superSecret'), function( err, user ){
          if( err ){
            res.redirect( '/' );
          }else if( user && user.id ){
            if( user.role == 0 ){
              res.redirect( '/admin' );
            }else{
              res.redirect( '/' );
            }
          }else{
            res.redirect( '/' );
          }
        });
      }else{
        res.redirect( '/?message=' + body1.message );
      }
    }
  });
});

app.post( '/logout', function( req, res ){
  req.session.token = null;
  res.redirect( '/' );
});


app.get( '/users', function( req, res ){
  var token = req.session.token; //req.body.token;
  var limit = ( req.query.limit ? req.query.limit : 0 );
  var skip = ( req.query.skip ? req.query.skip : 0 );

  var json1 = { token: token };
  if( limit ){ json1['limit'] = limit; }
  if( skip ){ json1['skip'] = skip; }
  var options1 = {
    url: settings.api_url + '/users',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, users1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( users1 );
      res.write( JSON.stringify( users1, 2, null ) );
      res.end();
    }
  });
});

app.post( '/user', function( req, res ){
  var token = req.session.token; //req.body.token;

  var json1 = { token: token };
  if( req.body.id ){ json1['id'] = req.body.id; }
  if( req.body.password ){ json1['password'] = req.body.password; }
  if( req.body.name ){ json1['name'] = req.body.name; }
  if( req.body.type ){ json1['type'] = req.body.type; }
  if( req.body.email ){ json1['email'] = req.body.email.split(','); }
  if( req.body.role ){ json1['role'] = parseInt( req.body.role ); } //. parseInt() 必須
  var options1 = {
    url: settings.api_url + '/user',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, user1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( user1 );
      res.write( JSON.stringify( user1, 2, null ) );
      res.end();
    }
  });
});

app.delete( '/user', function( req, res ){
  var token = req.session.token; //req.body.token;

  var json1 = { token: token };
  if( req.body.id ){ json1['id'] = req.body.id; }
  var options1 = {
    url: settings.api_url + '/user',
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, user1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( user1 );
      res.write( JSON.stringify( user1, 2, null ) );
      res.end();
    }
  });
});


app.get( '/items', function( req, res ){
  var token = req.session.token; //req.body.token;
  var limit = ( req.query.limit ? req.query.limit : 0 );
  var skip = ( req.query.skip ? req.query.skip : 0 );

  var json1 = { token: token };
  if( limit ){ json1['limit'] = limit; }
  if( skip ){ json1['skip'] = skip; }
  var options1 = {
    url: settings.api_url + '/items',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, items1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( items1 );
      res.write( JSON.stringify( items1, 2, null ) );
      res.end();
    }
  });
});

app.post( '/upload', function( req, res ){
  res.contentType( 'application/json' );

  var filepath = req.file.path;
  if( filepath ){
    var json1 = {
      'data': fs.createReadStream( filepath )
    };
    var token = req.session.token; //req.body.token;
    if( token ){
      //. 登録
      json1['token'] = token;

      //. トークンをデコード
      jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
        if( err ){
          fs.unlink( filepath, function(e){} );
          res.status( 401 );
          res.write( JSON.stringify( { status: false, error: 'Invalid token.' }, 2, null ) );
          res.end();
        }else if( user && user.id ){
          var user_id = user.id;

          var filename = req.file.originalname;
          var filemodified = req.body.file_modified;
          if( filename && filemodified ){
            fs.readFile( filepath, function( err, data ){
              if( err ){
                fs.unlink( filepath, function(e){} );

                res.status( 400 );
                res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
                res.end();
              }else{
                fs.unlink( filepath, function(e){} );

                json1['file_name'] = filename;
                json1['file_modified'] = Math.floor( filemodified );
                if( req.body.storefile ){
                  json1['storefile'] = req.body.storefile;
                }

                var options1 = {
                  url: settings.api_url + '/upload',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  formData: json1
                };
                request( options1, ( err1, res1, item1 ) => {
                  res.contentType( 'application/json' );
                  if( err1 ){
                    console.log( err1 ); //. {"status":false,"error":{"name":"ValidationException"}}
                    res.status( 403 );
                    res.write( JSON.stringify( err1, 2, null ) );
                    res.end();
                  }else{
                    res.write( JSON.stringify( item1, 2, null ) );
                    res.end();
                  }
                });
              }
            });
          }else{
            fs.unlink( filepath, function(e){} );
            res.status( 401 );
            res.write( JSON.stringify( { status: false, error: 'Invalid filename or/and modified datetime.' }, 2, null ) );
            res.end();
          }
        }else{
          fs.unlink( filepath, function(e){} );
          res.status( 401 );
          res.write( JSON.stringify( { status: false, error: 'Invalid token.' }, 2, null ) );
          res.end();
        }
      });
    }else{
      //. 確認
      var options1 = {
        url: settings.api_url + '/itemCheck',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        formData: json1
      };
      request( options1, ( err1, res1, item1 ) => {
        res.contentType( 'application/json' );
        if( err1 ){
          fs.unlink( filepath, function(e){} );
          console.log( err1 );
          res.status( 403 );
          res.write( JSON.stringify( err1, 2, null ) );
          res.end();
        }else{
          fs.unlink( filepath, function(e){} );
          //console.log( item1 );
          res.write( JSON.stringify( item1, 2, null ) );
          res.end();
        }
      });
    }
  }else{
    res.status( 403 );
    res.write( JSON.stringify( { status: false, error: 'File could not be found' }, 2, null ) );
    res.end();
  }
});

app.post( '/item', function( req, res ){
  var json1 = {};
  if( req.body.id ){ json1['id'] = req.body.id; }
  if( req.body.url ){ json1['url'] = req.body.url; }
  if( req.body.name ){ json1['name'] = req.body.name; }
  if( req.body.modified ){ json1['modified'] = new Date( req.body.modified ); }
  if( req.body.comment ){ json1['comment'] = req.body.body; }
  var options1 = {
    url: settings.api_url + '/item',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, comment1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( comment1 );
      res.write( JSON.stringify( comment1, 2, null ) );
      res.end();
    }
  });
});

app.delete( '/item', function( req, res ){
  var token = req.session.token; //req.body.token;

  var json1 = { token: token };
  if( req.body.id ){ json1['id'] = req.body.id; }
  var options1 = {
    url: settings.api_url + '/item',
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, item1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( item1 );
      res.write( JSON.stringify( item1, 2, null ) );
      res.end();
    }
  });
});

app.post( '/trade', function( req, res ){
  var token = req.session.token; //req.body.token;

  var json1 = { token: token };
  if( req.body.item_id ){ json1['item_id'] = req.body.item_id; }
  if( req.body.user_id ){ json1['user_id'] = req.body.user_id; }
  var options1 = {
    url: settings.api_url + '/trade',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: json1
  };
  request( options1, ( err1, res1, item1 ) => {
    res.contentType( 'application/json' );
    if( err1 ){
      console.log( err1 );
      res.status( 403 );
      res.write( JSON.stringify( err1, 2, null ) );
      res.end();
    }else{
      //console.log( item1 );
      res.write( JSON.stringify( item1, 2, null ) );
      res.end();
    }
  });
});


app.listen( port );
console.log( "server starting on " + port + " ..." );
