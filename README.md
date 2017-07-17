# Messenger-CLI

Messenger-CLI provides a way to access Facebook Messenger from the command line. You can send and receive messages in both group chats and direct messages.

It was written using [Node.js](https://nodejs.org) and [Facebook Chat API](https://github.com/Schmavery/facebook-chat-api).

## Installation
Clone this repo and run `npm start` in the directory – you will be guided through logging into Messenger from there. If you enter the wrong email or password, you can delete `credentials.js` to start the sign-in process again.

Once you have a successful login, it will be cached in a file called `appstate.json`, which is the default sign-in method. If this login expires, you may get cryptic errors when you try to start Messenger-CLI. If this happens, simply delete `appstate.json` and you will be logged in again using the credentials stored in `credentials.js` the next time you run the utility.

## Special commands
Currently, the only special command is `{emoji}`, which will be replaced with the group emoji for the thread it is sent to in any messages containing it. More commands are on the way.