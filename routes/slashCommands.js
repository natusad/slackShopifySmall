require('dotenv').config();
const express = require('express');
const slackKeys = require('../models/dataBase');
const axios = require('axios');
const router = express.Router();

router.post('/command', async (req, res) => {
    keys = await slackKeys.find({});
    const body = req.body;
    let order_id = body.text.replace('#', '');

    const URL = `https://${keys[0].shop}/admin/api/2021-01/orders.json?status=any`;
    
    let messages = [];
    let url = URL;

    await axios.get(url,
        {
            headers: {
                'X-Shopify-Access-Token': keys[0].token
            }
        }
    )
        .then((response) => {
            const data = response.data;
            const orders = data.orders;
            if (orders.length > 0) {
                const messagesData = orders.filter(item => `${item.order_number}`.localeCompare(order_id) === 0);
                messagesData.forEach(item => {
                    params = getParams(item);
                    messages.push(getOrder(params));
                });
            }
        }).catch(function (err) {
            console.log('Error:' + err)
        });


    if (messages.length === 0) {
        res.json({text: 'No results were found for this Request'});
        return;
    }

    res.json({attachments: messages});
});

function getLineItems(lineItems) {
    let lineItemsStr = '';

    lineItems.forEach(element => {
        lineItemsStr += `${element.quantity} x ${element.title}\n`;
    });

    return lineItemsStr;
}

function getParams(item) {
    const lineItems = item.line_items;
    const lineItemsStr = getLineItems(lineItems);

    return {
        orderID: item.name,
        currencyPrice: item.currency,
        customerName: item.customer.first_name + ' ' + item.customer.last_name,
        email: item.customer.email,
        totalPrice: item.total_price,
        lineItems: lineItemsStr
    };
}

function getOrder(params) {
    return {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `Order`,
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
    };
}

module.exports = router;