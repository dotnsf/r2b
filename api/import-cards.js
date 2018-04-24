//. import-cards.js
let IdCard = require('composer-common').IdCard;
let AdminConnection = require('composer-admin').AdminConnection;
let fs = require('fs');

const cardsPath = './cards/';

let adminConnection = new AdminConnection();
fs.readdirSync(cardsPath).forEach(file => {
  let id = file.substring(0, file.lastIndexOf('.card'));
  adminConnection.hasCard(id).then(hasCard => {
    if (!hasCard) {
      let data = fs.readFileSync(cardsPath + file);
      return IdCard.fromArchive(data);
    }
  }).then(card => {
    if (card != null) {
      return adminConnection.importCard(id, card);
    }
  }).then(result => {
    if (result != null) {
      console.log(id + ' card is imported successfully.');
    }
  }).catch(err => {
    console.log(err);
  });
});



