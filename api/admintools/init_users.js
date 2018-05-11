//. init_users.js
//.
//. (1) Create admin user(POST /api/adminuser)
//. (2) Login as admin(POST /api/login)
//. (3) Create users(POST /api/user)

var request = require( 'request' );
var app_settings = require( '../../app/settings' );
var init_settings = require( './init_settings' );

//. (1)
var option1 = {
  url: app_settings.api_url + '/adminuser',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  json: {
    password: init_settings.admin_password
  }
};
request( option1, ( err1, res1, result1 ) => {
  if( err1 ){
    console.log( 'err1' );
    console.log( err1 );
  }else{
    console.log( 'result1' );
    console.log( result1 );
  }

  //. (2)
  var option2 = {
    url: app_settings.api_url + '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    json: {
      id: 'admin',
      password: init_settings.admin_password
    }
  };
  request( option2, ( err2, res2, result2 ) => {
    if( err2 ){
      console.log( 'err2' );
      console.log( err2 );
    }else{
      console.log( 'result2' );
      console.log( result2 );

      //. Get token
      //result2 = JSON.parse( result2 );
      var token = result2.token;
      console.log( 'token = ' + token );

      //. (3)
      var cnt = 0;
      for( var i = 0; i < init_settings.users.length; i ++ ){
        var user = init_settings.users[i];

        var option3 = {
          url: app_settings.api_url + '/user',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': token
          },
          json: user
        };
        request( option3, ( err3, res3, result3 ) => {
          if( err3 ){
            console.log( 'err3[' + i + ']' );
            console.log( err3 );
          }else{
            console.log( 'result3[' + i + ']' );
            console.log( result3 );
          }
          cnt ++;
          if( cnt == init_settings.users.length ){
            console.log( 'Completed.' );
          }
        });
      }
    }
  });
});
