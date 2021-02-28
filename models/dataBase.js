const { Schema, model } = require('mongoose')

const schema = new Schema({
    tokenUser: {
        type: String,
        required: true
    },
    tokenBot: {
        type: String,
        required: true
    },
    shop: {
        type: String,
        required: true
    },
    token: {
        type: String,
        default: ''
    }
})

module.exports = model('SlackKeys', schema)