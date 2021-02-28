require('dotenv').config();
const express = require('express');
const router = express.Router();
const slackKeys = require('../models/dataBase');
const {WebClient} = require('@slack/web-api');

const BOT_CHANNEL_CREATE = "#app";
const BOT_CHANNEL_CANCEL = "#app";

router.post('/create', async (req, res) => {
    res.status(200).end();

    sendMessage(BOT_CHANNEL_CREATE, getParams(req), 'Create');
});

router.post('/cancel', async (req, res) => {
    res.status(200).end();

    sendMessage(BOT_CHANNEL_CANCEL, getParams(req), 'Cancel');
});

function getParams(req) {
    const lineItems = req.body.line_items;
    const lineItemsStr = getLineItems(lineItems);

    return {
        orderID: req.body.name,
        currencyPrice: req.body.currency,
        customerName: req.body.customer.first_name + ' ' + req.body.customer.last_name,
        email: req.body.customer.email,
        totalPrice: req.body.total_price,
        lineItems: lineItemsStr
    };
}

function getLineItems(lineItems) {
    let lineItemsStr = '';

    lineItems.forEach(element => {
        lineItemsStr += `${element.quantity} x ${element.title}\n`;
    });

    return lineItemsStr;
}

async function sendMessage (channel, params, type) {
    const message = [
        {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `Order ${type}`,
                        emoji: true
                    }
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Order number:*\n${params.orderID}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Customer:*\n${params.customerName}\n(${params.email})`
                        }
                    ]
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Line Items:*\n${params.lineItems}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Total:*\n${params.totalPrice} ${params.currencyPrice}`
                        }
                    ]
                }
            ]
        }
    ];

    const channels = channel.split(" ");

    keys = await slackKeys.find({});
    let SLACK_BOT_TOKEN = keys[0].tokenBot;
    console.log(SLACK_BOT_TOKEN);
    const web = new WebClient(SLACK_BOT_TOKEN);

    await channels.forEach(item => {
        web.chat.postMessage({
            channel: item,
            attachments: message,
        });
    });
}

module.exports = router;
