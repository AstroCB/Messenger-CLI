# Messenger-CLI

Messenger-CLI (MCLI) provides a way to access Facebook Messenger from the command line. You can send and receive messages in both group chats and direct messages.

It was written using [Node.js](https://nodejs.org) and [Facebook Chat API](https://github.com/Schmavery/facebook-chat-api).

## Installation
Clone this repo and run `npm install`. When the installation is complete, run `npm start` in the directory – you will be guided through logging into Messenger from there. If you enter the wrong email or password, you can delete `credentials.js` to start the sign-in process again.

Once you have a successful login, it will be cached in a file called `appstate.json`, which is the default sign-in method. If this login expires, you may get cryptic errors when you try to start MCLI. If this happens, simply delete `appstate.json` and you will be logged in again using the credentials stored in `credentials.js` the next time you run the utility.

## Usage
When your account receives new messages, they will appear onscreen (sent to stdout from wherever you are running the CLI). You can write new messages directly to stdin.

For the first message you send, you will have to explicitly specify the recipient like this:

```
> Recipient: message to send
```

MCLI will search your 20 most recent threads (configurable) for a chat name (for group chats) or a person's name (for one-on-one chats) that matches `Recipient`. After the first message is sent, you can simply continue to type new messages and they will be sent to the last recipient specified.

To send a message to someone else, simply specify a new recipient using the same syntax shown above.

## Special commands
Currently, the only special command is `{emoji}`, which will be replaced with the group emoji for the thread it is sent to in any messages containing it. More commands are on the way.
