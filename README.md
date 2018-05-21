# r2b


## Overview

R2B(Record to Blockchain) is one of public implementations of true file validation service using Hyperledger Fabric and Hyperledger Composer.

R2B supports simple CRUD API for User. It also support Creating API for Item, and Changing owner of it. These APIs would be run on port 3001(default).

## How to deploy business Network from API server.

- Prepare API server with Ubuntu 16.04.

- Login to that API Server(Ubuntu 16.04) with SSH or terminal

- (Once)Install Node.js(V6.x) and npm

    - `$ sudo apt-get install -y nodejs npm`

    - `$ sudo npm cache clean`

    - `$ sudo npm install n -g`

    - `$ sudo n list`

        - find latest 6.x.x version, for example 6.12.3

    - `$ sudo n 6.12.3`

    - `$ sudo apt-get purge nodejs npm`

- (Once)Install composer-cli

    - `$ npm install -g composer-cli`

- (Once)Prepare Hyperledger Fabric v1.

    - http://dotnsf.blog.jp/archives/1069641731.html

- (Once)Create BNC(Business Network Card) for PeerAdmin@hlfv1

    - `$ cd ~/fabric/; ./createPeerAdminCard.sh`

    - `$ cp /tmp/PeerAdmin@hlfv1.card ./`

- (Once)Import Created Business Network Card for PeerAdmin@hlfv1

    - `$ composer card import --file PeerAdmin@hlfv1.card`

- cd to api folder

    - `$ cd **/r2b/api`

- (Everytime after starting Hyperledger Fabric)Install r2b-network runtime

    - `$ composer runtime install --card PeerAdmin@hlfv1 --businessNetworkName r2b-network`

- (Everytime after starting Hyperledger Fabric)Start r2b-network with BNA

    - `$ composer network start --card PeerAdmin@hlfv1 --networkAdmin admin --networkAdminEnrollSecret adminpw --archiveFile r2b-network.bna --file cards/admin@r2b-network.card`

- (Once)Import BNC for admin@r2b-network

    - `$ composer card import --file cards/admin@r2b-network.card`

- (Everytime after starting Hyperledger Fabric)Ping to Business Network with admin@r2b-network(for confirmation)

    - `$ composer network ping --card admin@r2b-network`

## How to install/run Platform API( and API Document) in API Server

- Prepare API Server with Ubuntu 16.04

- Login to that API Server(Ubuntu 16.04) with SSH or terminal

- Install Node.js(V6.x) and npm

    - See above for detailed commands

- Prepare for folowing composer commands

    - `$ cd **/r2b/api`

- Install dependencies

    - `$ npm install`

- (Optional)Edit public/doc/swagger.yaml host value for Swagger API Document, if needed.

- (Optional)Edit setttings.js, if needed.

    - exports.cardName : Business Network Card name for Hyperledger Fabric access

    - exports.superSecret : Seed string for encryption

    - exports.basic_username : Username for Basic authentication

    - exports.basic_password : Password for Basic authentication

- Run app.js with Node.js

    - `$ node app`

## Set admin Password

- If this is your first time access after deployment of Business Network, you should set password for user "admin", who is privileaged user with role 0, as soon as possible:

    - `$ curl -XPOST -H 'Content-Type: application/json' 'http://xx.xx.xx.xx:3001/api/adminuser' -d '{"password":"(password for admin)"}'`

## Access to Swagger API Document

- Browse this URL:

    - http://xx.xx.xx.xx:3001/doc/

- Basic authentication:

    - See api/settings.js : exports.basic_username and exports.basic_password

## How to initialize Platform, and how to test.

1. Call **POST /api/adminuser** to create admin user

2. Call **POST /api/login** to login with admin user, and get token

3. Call **POST /api/user** to create non-admin user. You need to specify token from 2.

4. Call **GET /api/users** to view all users. You need to specify token from 2.

5. Call **POST /api/login** to login with non-admin user, and get token

6. Call **POST /api/item** to create item. You need to specify token from 5.

7. Call **GET /api/items** to view all items. You need to specify token from 5.


## How to setup sample web application under app/

- Prepare for folowing composer commands

    - `$ cd **/r2b/app`

- Install dependencies

    - `$ npm install`

- (Optional)Edit setttings.js, if needed.

    - exports.api_url : URL for above API Platform

    - exports.superSecret : Seed string for encryption( this has to be same value with the ones of API)

    - exports.basic_username : Username for Basic authentication

    - exports.basic_password : Password for Basic authentication

- Run app.js with Node.js

    - `$ node app`






## Licensing

This code is licensed under MIT.

https://github.com/dotnsf/r2b/blob/master/MIT-LICENSE.txt

## Copyright

2018 [K.Kimura @ Juge.Me](https://github.com/dotnsf) all rights reserved.
