#!/bin/bash

composer runtime install --card PeerAdmin@hlfv1 --businessNetworkName r2b-network

composer network start --card PeerAdmin@hlfv1 --networkAdmin admin --networkAdminEnrollSecret adminpw --archiveFile ../r2b-network.bna --file ~/peerAdmin@hlfv1.card

composer network ping --card admin@r2b-network
