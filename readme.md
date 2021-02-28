**Requirements:**

0. Domain with SSL, connected to your Server (config Nginx or apache must listen(or proxied) port 3000)
1. nodeJs+npm installed at the server
2. Account https://cloud.mongodb.com/
3. Shopify partner Account - https://partners.shopify.com/
4. .env file must be in the root directory 

This instruction provided for the Ubuntu server with Nginx Configured for example.com domain. Don't forget to change example.com to your Domain 

*********

**1 Step -  install & start App at the server**
First of all, you need to clone this repo to the domain root  directory 

    git clone https://gitlab.com/owo-main/slackbot

then install dependencies from the root directory

    npm i

Now you can use npm start to start App at the port 3000, but it's really not comfortable to use. because App will work only in pair with your terminal. 

For good experience on your server install pm2  - it's the perfect App manager

    sudo npm install pm2 -g

in the root directory, we have a config for it, you need to start App with pm2 and config

Start App from the root directory

    pm2 start pm2.js

you can use:

    pm2 ls -  to list All Apps with additional info
    pm2 stop 0 -  to stop App with id 0
    pm2 start\restart 0 - to start\restart App with id 0


After you start your App with pm2 manager And if your Nginx configured to listen to port 3000 you can  see a page with the text "Hello, in Bot"

After that, you are ready to Create Shopify App 

**2 Step - Creating App at the Shopify Partner**

At the page <https://partners.shopify.com/> at the section APPS click button "Create App"
Choose Public App
Write any App name
at the App URL past link 

    https://example.com/shopify/

At the Allowed redirection URL(s) paste

    https://example.com/shopify/callback 


**Step 3 - configure Env file**

1. After you saved it, Shopify will provide 2 tokens you need to add to the env file
2. at the SHOPIFY_URL_URL change domain to yours, without HTTPS
3. at the <https://cloud.mongodb.com/> create cluster and press "connect" at the list of clusters it will provide to you link like 
    mongodb+srv://USER:PASS@cluster0.cp4cx.mongodb.net/CLUTERNAME
change credentials to yours and paste it to the env file 
4. save env file

**Step 4. Add App to the store**
At the Shopify Partner Acc inside your App settings at the section "Test your app"  press "select store" and add it to your store. 

Or if you want to add it to the Shopify App Listing (to install any), You can create a listing and Submit App to review by Shopify.

