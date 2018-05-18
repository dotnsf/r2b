#!/bin/bash

composer runtime install --card PeerAdmin@hlfv1 --businessNetworkName r2b-network

composer network start --card PeerAdmin@hlfv1 --networkAdmin admin --networkAdminEnrollSecret adminpw --archiveFile ../r2b-network.bna --file ../cards/admin@r2b-network.card

composer card import --file ../cards/admin@r2b-network.card

composer network ping --card admin@r2b-network
