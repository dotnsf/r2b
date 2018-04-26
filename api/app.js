//.  app.js
var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    bodyParser = require( 'body-parser' ),
    cfenv = require( 'cfenv' ),
    crypto = require( 'crypto' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    jwt = require( 'jsonwebtoken' ),
    multer = require( 'multer' ),
    app = express();
var settings = require( './settings' );
var appEnv = cfenv.getAppEnv();

const HyperledgerClient = require( './hyperledger-client' );
const client = new HyperledgerClient();

app.set( 'superSecret', settings.superSecret );

app.use( multer( { dest: './tmp/' } ).single( 'data' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );

app.all( '/doc*', basicAuth( function( user, pass ){
  return ( user === settings.basic_username && pass === settings.basic_password );
}));

app.use( express.static( __dirname + '/public' ) );

var apiRoutes = express.Router();

apiRoutes.post( '/login', function( req, res ){
  res.contentType( 'application/json' );
  var id = req.body.id;
  var password = req.body.password;
  client.getUserForLogin( id, user => {
    if( id && password && user.password == password ){
      var token = jwt.sign( user, app.get( 'superSecret' ), { expiresIn: '25h' } );

      //. user.loggedin を更新する
      client.userLoggedInTx( user.id, success => {
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      }, error => {
        console.log( error );
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      });
      /*
      user.loggedin = new Date();
      client.updateUserTx( user, success => {
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      }, error => {
        console.log( error );
        res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
        res.end();
      });
      */
    }else{
      res.status( 401 );
      res.write( JSON.stringify( { status: false, result: 'Not valid id/password.' }, 2, null ) );
      res.end();
    }
  }, error => {
    console.log( 'getUserForLogin error: ' + JSON.stringify( error, 2, null ) );
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'Not valid id/password.' }, 2, null ) );
    res.end();
  });
});

apiRoutes.post( '/adminuser', function( req, res ){
  res.contentType( 'application/json' );
  var id = 'admin'; //req.body.id;
  var password = req.body.password;
  if( !password ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No password provided.' }, 2, null ) );
    res.end();
  }else{
    client.getUser( id, user => {
      res.status( 400 );
      res.write( JSON.stringify( { status: false, result: 'User ' + id + ' already existed.' }, 2, null ) );
      res.end();
    }, error => {
      var user = { id: id, password: password, name: 'admin', role: 0 };

      client.createUserTx( user, result => {
        res.write( JSON.stringify( { status: true }, 2, null ) );
        res.end();
      }, error => {
        console.log( error );
        res.status( 500 );
        res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
        res.end();
      });
    });
  }
});

apiRoutes.post( '/itemCheck', function( req, res ){
  res.contentType( 'application/json' );

  var filepath = req.file.path;

  if( filepath ){
    fs.readFile( filepath, function( err, data ){
      if( err ){
        fs.unlink( filepath, function(e){} );

        res.status( 400 );
        res.write( JSON.stringify( { status: false, result: err }, 2, null ) );
        res.end();
      }else{
        //console.log( data );
        fs.unlink( filepath, function(e){} );

        //. hash 化
        var hash = crypto.createHash( 'sha512' );
        hash.update( data );
        var data_hash = hash.digest( 'hex' );

        //. 存在チェック
        client.getItemByHash( data_hash, item => {
          if( item != null ){
            //. 登録済み
            res.write( JSON.stringify( { status: true, result: 'data found.' }, 2, null ) );
            res.end();
          }else{
            //. 未登録
            res.write( JSON.stringify( { status: true, result: 'data not found.' }, 2, null ) );
            res.end();
          }
        }, error => {
          //. 未登録
          res.write( JSON.stringify( { status: true, result: 'data not found.' }, 2, null ) );
          res.end();
        });
      }
    });
  }else{
    fs.unlink( filepath, function(e){} );
    res.status( 400 );
    res.write( JSON.stringify( { status: false, result: 'file stream not found.' }, 2, null ) );
    res.end();
  }
});

//. ここより上で定義する API には認証フィルタをかけない
//. ここより下で定義する API には認証フィルタをかける
apiRoutes.use( function( req, res, next ){
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    return res.status( 403 ).send( { status: false, result: 'No token provided.' } );
  }

  jwt.verify( token, app.get( 'superSecret' ), function( err, decoded ){
    if( err ){
      return res.json( { status: false, result: 'Invalid token.' } );
    }

    req.decoded = decoded;
    next();
  });
});


apiRoutes.post( '/user', function( req, res ){
  res.contentType( 'application/json' );
  //console.log( 'POST /user' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id && user.role == 0 ){
        var dt = new Date();

        var id = req.body.id;
        var password = req.body.password;
        var name = req.body.name;
        var type = req.body.type;
        var email = ( req.body.email ? req.body.email : [] );
        var role = req.body.role;

        client.getUser( id, user0 => {
          //. 更新
          var user1 = {
            id: id,
            password: ( password ? password : user0.password ),
            name: ( name ? name : user0.name ),
            type: ( type ? type : user0.type ),
            email: ( email ? email : user0.email ),
            role: ( role ? role : user0.role )
          };
          client.updateUserTx( user1, result => {
            console.log( 'result(1)=' + JSON.stringify( result, 2, null ) );
            res.write( JSON.stringify( { status: true, result: result }, 2, null ) );
            res.end();
          }, error => {
            console.log( error );
            res.status( 500 );
            res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
            res.end();
          });
        }, error => {
          //. 新規作成
          if( id && password && name ){
            var user1 = {
              id: id,
              password: password,
              name: name,
              type: type,
              email: email,
              role: role
            };
            client.createUserTx( user1, result => {
              console.log( 'result(0)=' + JSON.stringify( result, 2, null ) );
              res.write( JSON.stringify( { status: true, result: result }, 2, null ) );
              res.end();
            }, error => {
              res.status( 500 );
              res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
              res.end();
            });
          }else{
            //. 必須項目が足りない
            res.status( 400 );
            res.write( JSON.stringify( { status: false, result: 'Failed to create/update new user.' }, 2, null ) );
            res.end();
          }
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Valid token is missing.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.get( '/users', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        client.getAllUsers( result => {
          var users = [];
          switch( user.role ){
          case 0: //. admin
            //. 全ユーザーが見える
            var result0 = [];
            result.forEach( user0 => {
              result0.push( { id: user0.id, name: user0.name, type: user0.type, email: user0.email, role: user0.role, created: user0.created, loggedin: user0.loggedin } );
            });
            users = result0;
            break;
          default:
            //. 自分しか見れない
            var result0 = [];
            result.forEach( user0 => {
              if( user0.id == user.id ){
                result0.push( { id: user0.id, name: user0.name, type: user0.type, email: user0.email, role: user0.role, created: user0.created, loggedin: user0.loggedin } );
              }
            });
            users = result0;
            break;
          }

          res.write( JSON.stringify( { status: true, result: users }, 2, null ) );
          res.end();
        }, error => {
          res.status( 500 );
          res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
          res.end();
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.post( '/queryUsers', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        var keyword = req.body.keyword;
        client.queryUsers( keyword, result => {
          var users = [];
          switch( user.role ){
          case 0: //. admin
            //. 全ユーザーが見える
            var result0 = [];
            result.forEach( user0 => {
              result0.push( { id: user0.id, name: user0.name, type: user0.type, email: user0.email, role: user0.role, created: user0.created, loggedin: user0.loggedin } );
            });
            users = result0;
            break;
          default:
            //. 自分しか見れない
            var result0 = [];
            result.forEach( user0 => {
              if( user0.id == user.id ){
                result0.push( { id: user0.id, name: user0.name, type: user0.type, email: user0.email, role: user0.role, created: user0.created, loggedin: user0.loggedin } );
              }
            });
            users = result0;
            break;
          }

          res.write( JSON.stringify( { status: true, result: users }, 2, null ) );
          res.end();
        }, error => {
          res.status( 500 );
          res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
          res.end();
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.get( '/user', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        var id = req.query.id;
        switch( user.role ){
        case 0: //. admin
          //. 全ユーザーが見える
          client.getUser( id, result => {
            res.write( JSON.stringify( { status: true, result: result }, 2, null ) );
            res.end();
          }, error => {
            res.status( 404 );
            res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
            res.end();
          });
          break;
        default:
          //. 自分しか見れない
          if( id == user.id ){
            res.write( JSON.stringify( { status: true, result: user }, 2, null ) );
            res.end();
          }else{
            res.status( 403 );
            res.write( JSON.stringify( { status: false, result: 'Forbidden' }, 2, null ) );
            res.end();
          }
          break;
        }
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.delete( '/user', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id && user.role == 0 ){
        //console.log( 'DELETE /user : user.id = ' + user.id );

        var id = req.body.id;

        client.deleteUserTx( id, result => {
          res.write( JSON.stringify( { status: true, result: null }, 2, null ) );
          res.end();
        }, error => {
          res.status( 404 );
          res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
          res.end();
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Valid token is missing.' }, 2, null ) );
        res.end();
      }
    });
  }
});


apiRoutes.post( '/item', function( req, res ){
  res.contentType( 'application/json' );
  var filepath = req.file.path; //. "TypeError: Cannot read property "path" of undefined
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    fs.unlink( filepath, function(e){} );
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        fs.unlink( filepath, function(e){} );
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        var user_id = user.id;

        var fileoriginalname = req.file.originalname;
        var filename = req.body.file_name;
        var filemodified = Math.floor(req.body.file_modified);

        if( filepath && filename && /*filename == fileoriginalname &&*/ filemodified ){
          fs.readFile( filepath, function( err, data ){
            if( err ){
              fs.unlink( filepath, function(e){} );

              res.status( 400 );
              res.write( JSON.stringify( { status: false, result: err }, 2, null ) );
              res.end();
            }else{
              //console.log( data );
              fs.unlink( filepath, function(e){} );

              //. hash 化
              var hash = crypto.createHash( 'sha512' );
              hash.update( data );
              var data_hash = hash.digest( 'hex' );

              //. 存在チェック
              client.getItemByHash( data_hash, item => {
                if( item != null ){
                  //. 登録済み
                  res.status( 400 );
                  res.write( JSON.stringify( { status: false, result: 'same data already registered.' }, 2, null ) );
                  res.end();

                  //. 通知？
                  console.log( 'same data already registered for ' + filename );
                  console.log( item );
                }else{
                  //. 未登録
                  filemodified = new Date( filemodified );

                  hash = crypto.createHash( 'sha512' );
                  var obj = { name: filename, modified: filemodified, data: data };
                  hash.update( Buffer.from( JSON.stringify( obj ) ) );
                  var id = hash.digest( 'hex' );

                  //. 作成
                  var item = { id: id, user_id: user_id, name: filename, hash: data_hash, modified: filemodified };
                  client.createItemTx( item, result => {
                    //console.log( result );
                    res.write( JSON.stringify( { status: true, result: 'successfully registered(' + id + ').' }, 2, null ) );
                    res.end();
                  }, error1 => {
                    console.log( error1 );
                    res.status( 400 );
                    res.write( JSON.stringify( { status: false, result: error1 }, 2, null ) );
                    res.end();
                  });
                }
              }, error => {
                //. 未登録
                hash = crypto.createHash( 'sha512' );
                var obj = { name: filename, modified: modified, data: data };
                hash.update( obj );
                var id = hash.digest( 'hex' );

                //. 作成
                var user_id = null;
                var item = { id: id, user_id: user_id, name: filename, hash: data_hash, modified: modified };
                client.createItemTx( item, result => {
                  res.write( JSON.stringify( { status: true, result: 'successfully registered.' }, 2, null ) );
                  res.end();
                }, error1 => {
                  res.status( 400 );
                  res.write( JSON.stringify( { status: false, result: error1 }, 2, null ) );
                  res.end();
                });
              });
            }
          });
        }else{
          fs.unlink( filepath, function(e){} );
          res.status( 400 );
          res.write( JSON.stringify( { status: false, result: 'required parameters not satisfied.' }, 2, null ) );
          res.end();
        }
      }else{
        fs.unlink( filepath, function(e){} );
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Valid token is missing.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.get( '/items', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        /*
        client.getAllItems( result => {
          var items = [];
          switch( user.role ){
          case 0: //. admin
            //. 全商品が見える
            var result0 = [];
            result.forEach( item0 => {
              result0.push( { id: item0.id, rev: item0.rev, name: item0.name, hash: item0.hash, datetime: item0.datetime, owner: item0.owner.toString(), modified: item0.modified } );
            });
            items = result0;
            break;
          default:
            //. 自分のアイテムしか見れない
            var result0 = [];
            result.forEach( item0 => {
              if( item0.owner.toString().endsWith( '#' + user.id + '}' ) ){
                result0.push( { id: item0.id, rev: item0.rev, name: item0.name, hash: item0.hash, datetime: item0.datetime, owner: item0.owner.toString(), modified: item0.modified } );
              }
            });
            items = result0;
            break;
          }
          */

        client.getItemsByUser( user, result => {
          var items = result;

          res.write( JSON.stringify( { status: true, result: items }, 2, null ) );
          res.end();
        }, error => {
          res.status( 500 );
          res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
          res.end();
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.get( '/item', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        var id = req.query.id;
        client.getItem( id, result => {
          switch( user.role ){
          case 0: //. admin
            //. 全商品が見える
            res.write( JSON.stringify( { status: true, result: result }, 2, null ) );
            res.end();
            break;
          default:
            //. 自分しか見れない
            if( result.owner.id == user.id ){
              res.write( JSON.stringify( { status: true, result: result }, 2, null ) );
              res.end();
            }else{
              res.status( 403 );
              res.write( JSON.stringify( { status: false, result: 'Forbidden' }, 2, null ) );
              res.end();
            }
            break;
          }
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }
    });
  }
});

apiRoutes.delete( '/item', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id && user.role == 0 ){
        var id = req.body.id;

        client.deleteItemTx( id, result => {
          res.write( JSON.stringify( { status: true, result: null }, 2, null ) );
          res.end();
        }, error => {
          res.status( 404 );
          res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
          res.end();
        });
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Valid token is missing.' }, 2, null ) );
        res.end();
      }
    });
  }
});



apiRoutes.post( '/trade', function( req, res ){
  res.contentType( 'application/json' );
  var token = req.body.token || req.query.token || req.headers['x-access-token'];
  if( !token ){
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else if( user && user.id ){
        var item_id = req.body.item_id;
        if( !item_id ){
          res.status( 404 );
          res.write( JSON.stringify( { status: false, result: 'No item_id provided' }, 2, null ) );
          res.end();
        }else{
          client.getItem( item_id, item => {
            if( item && item.owner ){
              if( item.owner.id == user.id ){
                var user_id = req.body.user_id;
                client.getUser( user_id, new_owner => {
                  client.changeOwnerTx( item, new_owner, result => {
                    res.write( JSON.stringify( { status: true, result: null }, 2, null ) );
                    res.end();
                  }, error => {
                    res.status( 404 );
                    res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
                    res.end();
                  });
                }, error => {
                  console.log( error );
                  res.status( 404 );
                  res.write( JSON.stringify( { status: false, result: error }, 2, null ) );
                  res.end();
                });
              }else{
                res.status( 404 );
                res.write( JSON.stringify( { status: false, result: 'Invalid item_id.' }, 2, null ) );
                res.end();
              }
            }else{
              res.status( 401 );
              res.write( JSON.stringify( { status: false, result: 'Invalid item_id.' }, 2, null ) );
              res.end();
            }
          }, error => {
            res.status( 404 );
            res.write( JSON.stringify( { status: false, result: 'No item found with id = ' + item_id + '.' }, 2, null ) );
            res.end();
          });
        }
      }else{
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Valid token is missing.' }, 2, null ) );
        res.end();
      }
    });
  }
});




app.use( '/api', apiRoutes );

var port = 3001 /*appEnv.port || 3000*/;
app.listen( port );
console.log( "server starting on " + port + " ..." );
