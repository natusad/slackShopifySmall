const express = require("express");
const app = express();
const dotenv = require('dotenv');
const request = require('request-promise');
const fetch = require("isomorphic-fetch");
const nonce = require('nonce')();
const slackKeys = require('../models/dataBase');
dotenv.config();

app.get('/shopify', (req, res) => {
    const shopName = req.query.shop; // Shop Name passed in URL'
    console.log("start shopify redirect")
    if (shopName) {
        const shopState = nonce();
        const redirectUri = `https://${process.env.SHOPIFY_APP_URL}/shopify/callback`; // Redirect URI for shopify Callback
        const installUri = 'https://' + shopName +
            '/admin/oauth/authorize?client_id=' + process.env.SHOPIFY_API_KEY +
            '&scope=' + process.env.SHOPIFY_API_SCOPES +
            '&state=' + shopState +
            '&accessMode=offline' +
            '&redirect_uri=' + redirectUri; // Install URL for app install

        res.cookie('state', shopState);
        res.redirect(installUri);
    } else {
        return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
    }
});

app.get('/shopify/callback', (req, res) => {
    const {
        shop,
        hmac,
        code,
        shopState
    } = req.query;

    if (shop && code) {
        const map = Object.assign({}, req.query);
        delete map['signature'];

        const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
        const accessTokenPayload = {
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code,
        };
        request.post(accessTokenRequestUrl, {
            json: accessTokenPayload
        })
            .then((accessTokenResponse) => {
                console.log("accessTokenResponse", accessTokenResponse)
                const accessToken = accessTokenResponse.access_token;
                console.log("accessToken", accessToken)
                const shopRequestUrl = `https://${shop}/admin/api/2020-10/shop.json`;
                const shopRequestHeaders = {
                    'X-Shopify-Access-Token': accessToken,
                };

                request.get(shopRequestUrl, {
                    headers: shopRequestHeaders
                })
                    .then((shopResponse) => {
                        (async () => {
                            //res.redirect('https://' + shop + '/admin/apps');
                            const shop_webhooks = `https://${shop}/admin/api/2021-01/webhooks.json`;
                            const ids = await getWebhooks(shop_webhooks, shopRequestHeaders);
                            console.log(ids);
                            const keys = await slackKeys.find({});
                            let tokenBot = '';
                            let tokenUser = '';
                            if(keys.length > 0) {
                                tokenBot = keys[0].tokenBot;
                                tokenUser = keys[0].tokenUser;
                            }

                            if(keys.length > 0) {
                                keys[0].token = accessToken;
                                await keys[0].save();
                            }

                            res.send(getForm(shop, accessToken, ids[0], ids[1], tokenBot, tokenUser));
                        })();
                    })
                    .catch((error) => {
                        res.status(error.statusCode).send(error.error.error_description);
                    });
            })
            .catch((error) => {
                res.status(error.statusCode).send(error.error.error_description);
            });

    } else {
        res.status(400).send('Required parameters missing');
    }
});

app.post('/shopify/create/webhooks', async (req, res) => {
    if (!req.body) return res.sendStatus(400);
    const body = req.body;
    console.log(body);

    const create_order = typeof body.checkbox_order_create !== "undefined"
    && body.checkbox_order_create.localeCompare('on') === 0 ?
        body.checkbox_order_create : false;
    const cancel_order = typeof body.checkbox_order_cancel !== "undefined"
    && body.checkbox_order_cancel.localeCompare('on') === 0 ?
        body.checkbox_order_cancel : false;
    const shop = body.shop;
    const accessToken = body.accessToken;
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };
    const id_order_create = body.id_order_create;
    const id_order_cancel = body.id_order_cancel;
    const tokenBot = body.token_bot;
    const tokenUser = body.token_user;
;
    const shop_create_webhooks = `https://${shop}/admin/api/2021-01/webhooks.json`;
    if (create_order) {
        await AddWebhooks(shop_create_webhooks, shopRequestHeaders, "orders/create", "create");
    } else if(id_order_create.localeCompare('') !== 0) {
        const shop_delete_webhooks = getDeleteUri(shop, id_order_create);
        await deleteWebhooks(shop_delete_webhooks, shopRequestHeaders);
    }

    if (cancel_order) {
        await AddWebhooks(shop_create_webhooks, shopRequestHeaders, "orders/cancelled", "cancel");
    } else if(id_order_cancel.localeCompare('') !== 0) {
        const shop_delete_webhooks = getDeleteUri(shop, id_order_cancel);
        await deleteWebhooks(shop_delete_webhooks, shopRequestHeaders);
    }

    const keys = await slackKeys.find({});

    if(tokenBot !== '' && tokenUser !== '') {
        if(keys.length === 0) {
            const tokenKeys = new slackKeys({
                tokenUser: tokenUser,
                tokenBot: tokenBot,
                shop: shop,
                token: accessToken,
            });

            await tokenKeys.save();
        } else {
            keys[0].tokenUser = tokenUser;
            keys[0].tokenBot = tokenBot;
            keys[0].shop = shop;
            await keys[0].save();
        }
    }

    if(keys.length > 0) {
        keys[0].token = accessToken;
        await keys[0].save();
    }

    const redirect_uri = `https://${process.env.SHOPIFY_APP_URL}/shopify?shop=${shop}`;

    res.redirect(redirect_uri);
});

//body.id_order_cancel, body.id_order_create
function getDeleteUri(shop, id) {
    return `https://${shop}/admin/api/2021-01/webhooks/${id}.json`;
}

function deleteWebhooks(shop_delete_webhooks, shopRequestHeaders) {
    request({
        headers: shopRequestHeaders,
        method: 'DELETE',
        url: shop_delete_webhooks,
    }).then(response => {
        console.log(response)
    }).catch(function (err) {
        console.log('Error:' + err)
    });
}

//"orders/create", "orders/cancelled"
function AddWebhooks(shop_create_webhooks, shopRequestHeaders, topic, type) {
    request.post(shop_create_webhooks, {
        headers: shopRequestHeaders,
        json: {
            "webhook": {
                "topic": topic,
                "address": `https://${process.env.SHOPIFY_APP_URL}/webhooks/order/${type}`,
                "format": "json"
            }
        }
    }).then(response => {
        console.log(response)
    }).catch(function (err) {
        console.log('Error:' + err)
    });
}

async function getWebhooks(shop_webhooks, shopRequestHeaders) {
    var id_order_create = '';
    var id_order_cancel = '';

    await request.get(shop_webhooks, {
        headers: shopRequestHeaders,
    }).then(response => {
        const data = JSON.parse(response);
        console.log(data.webhooks);
        data.webhooks.forEach(item => {
            switch (item.topic) {
                case 'orders/cancelled' :
                    id_order_cancel = `${item.id}`;
                    break;
                case 'orders/create' :
                    id_order_create = `${item.id}`;
                    break;
            }
        });
    }).catch(function (err) {
        console.log('Error:' + err)
    });

    return [id_order_create, id_order_cancel];
}

function getForm(shop, accessToken, id_order_create, id_order_cancel, token_bot, token_user) {
    const style = getStyle();
    const forma = `<div class="webhooks-app-wrp"><form 
                 action="https://${process.env.SHOPIFY_APP_URL}/shopify/create/webhooks"
                 class="form" method="post">
                  <h3 class="title">
                       Sopify Event Notifications
                  </h3>
                 <label class="label">
                    <input type="checkbox" class="checkbox" name="checkbox_order_create"${id_order_create !== '' ? 'checked' : ''}>
                    Order Create
                </label>
                            
                 <label class="label">
                      <input type="checkbox" class="checkbox" name="checkbox_order_cancel" ${id_order_cancel !== '' ? 'checked' : ''}>
                       Order Canceled
                 </label>
                 
                  <h3 class="title">
                       OAuth Tokens for Your Team
                  </h3>
                  
                 <label class="label token">
                        Bot Token
                      <input type="text" class="token" name="token_bot" value="${token_bot}">
                 </label>
                  
                  <label class="label token">
                        User Token
                      <input type="text" class="token" name="token_user" value="${token_user}">
                  </label>
                  
                  <input type="hidden" name="shop" value="${shop}">
                  <input type="hidden" name="id_order_create" value="${id_order_create}">
                  <input type="hidden" name="id_order_cancel" value="${id_order_cancel}">
                  <input type="hidden" name="accessToken" value="${accessToken}">
                  
                 <button class="submit">
                       Submit
                 </button>
            </form></div>`;

    return style + forma + blockRegToken();
}

function blockRegToken() {
    return `<div class="token-reg-block-wrp">
                <div class="token-reg-block">
                    <h3 class="title">
                        Register tokens
                    </h3>
                    <p>
                        In order to register a bot, follow this link: 
                        <a href="https://api.slack.com/apps?new_app=1">https://api.slack.com/apps?new_app=1</a>
                    </p>
                    <p>
                        Register as shown in the video
                        <a href="https://www.screencast.com/t/mpFL4Fp1LLda">https://www.screencast.com/t/mpFL4Fp1LLda</a>
                    </p>
                </div>
            </div>`;
}

function getStyle() {
    return `<style>
                        .webhooks-app-wrp,
                         .token-reg-block-wrp {
                            width: 100%;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }

                        .webhooks-app-wrp .form,
                        .token-reg-block {
                            border: 1px solid dimgrey;
                            border-radius: 5px;
                            font-size: 15px;
                            font-family: sans-serif;
                            padding: 20px;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            max-width: 500px;
                            width: 100%;    
                        }
                        
                        .webhooks-app-wrp .form .label {
                            margin-bottom: 10px;
                            display: flex;
                            align-items: center;
                        }
                        
                        .webhooks-app-wrp .form .label input.token {
                            width: 500px;
                            border-radius: 5px;
                            border: 1px solid black;
                            padding: 5px;
                        }
                        
                        .webhooks-app-wrp .form .label.token {
                            flex-direction: column;
                            align-items: flex-start;
                            margin-bottom: 10px;
                        }
                        
                        .webhooks-app-wrp .form .label .checkbox {
                            margin-right: 10px;
                        }
                        
                         .webhooks-app-wrp .form button {
                            margin-top: 25px;
                            width: 130px;
                            border: none;
                            background: seagreen;
                            color: #fff;
                            height: 30px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: .4s all linear;
                        }
                        
                        .webhooks-app-wrp .form button:hover {
                            box-shadow: 4px 4px 4px rgba(0, 0, 0, 0.25);
                        }
                </style>`;
}

//Export the routes
module.exports = app;
