// Dependencies
const login = require("facebook-chat-api");
const fs = require("fs");
const readline = require("readline");
const notifier = require('node-notifier');
// Internal colors module for Terminal output'
const colored = require("./colors").colorString;
// Global access variables
let gapi, active, rl;

try {
	// Look for stored appstate first
	login({ "appState": JSON.parse(fs.readFileSync("appstate.json", "utf8")) }, callback);
} catch (e) {
	// If none found (or expired), log in with email/password
	try {
		// Look for stored credentials in a gitignored credentials.js file
		const credentials = require("./credentials");
		logInWithCredentials(credentials);
	} catch (e) {
		// If none found, ask for them
		initPrompt();
		rl.question("What's your Facebook email? ", (email) => {
			rl.question("What's your Facebook password? ", (pass) => {
				// Store credentials for next time
				fs.writeFileSync("credentials.js", `exports.email = "${email}";\nexports.password = "${pass}";`);

				// Pass to the login method (which should store an appstate as well)
				const credentials = require("./credentials");
				logInWithCredentials(credentials);
			});
		});
	}
}

/*
	Takes a credentials object with `email` and `password` fields and logs into the Messenger API.
	
	If successful, it stores an appstate to cache the login and passes off the API object to the callback.
	Otherwise, it will return an error specifying what went wrong and log it to the console.
*/
function logInWithCredentials(credentials, callback = main) {
	login({ "email": credentials.email, "password": credentials.password }, (err, api) => {
		if (err) return console.error(err);

		fs.writeFileSync("appstate.json", JSON.stringify(api.getAppState()));
		callback(api);
	});
}

/*
	Initializes a readline interface and sets up the prompt for future input.

	Returns the readline interface.
*/
function initPrompt() {
	if (!rl) {
		let rlInterface = readline.createInterface({
			"input": process.stdin,
			"output": process.stdout
		});
		rlInterface.setPrompt("> ");
		rl = rlInterface;
	}
}

/*
	Main body of the CLI.
	
	Listens for new messages and logs them to stdout. Messages can be sent from
	stdin using the format described in README.md.
*/
function main(api) {
	// Use minimal logging from the API
	api.setOptions({ "logLevel": "warn", "listenEvents": true });
	// Initialize the global API object
	gapi = api;

	// Set up the prompt for sending new messages
	initPrompt();
	rl.prompt();

	// Listen to the stream of incoming messages and log them as they arrive
	api.listen((err, msg) => {
		if(msg.type == "message") { // Message received
			api.getThreadInfo(msg.threadID, (err, tinfo) => {
				api.getUserInfo(msg.senderID, (err, uinfo) => {
					// If there are attachments, grab their URLs to render them as text instead
					const atts = msg.attachments.map((a) => { return a.url || a.facebookUrl; }).filter((a) => { return a; });
					const atext = atts.length > 0 ? `${msg.body} [${atts.join(", ")}]` : msg.body;

					// Log the incoming message and reset the prompt
					newPrompt(`${colored(uinfo[msg.senderID].firstName, "fgblue")} in ${colored(tinfo.name, "fggreen")} ${atext}`, rl);
					// Show up the notification for the new incoming message
					notifier.notify({
						title: 'Messenger CLI',
						message: 'You have unread messages from: ' + uinfo[msg.senderID].firstName
					});
				});
			});
		} else if (msg.type == "event") { // Chat event received
			api.getThreadInfo(msg.threadID, (err, tinfo) => {
				// Log the event information and reset the prompt
				newPrompt(`${colored(`[${tinfo.name}] ${msg.logMessageBody}`, "fgyellow")}`, rl);
			});
		}
	});

	// Watch stdin for new messages (terminated by newlines)
	rl.on("line", (line) => {
		const terminator = line.indexOf(":");
		if (terminator == -1) {
			// No recipient specified: send it to the last one messaged if available; otherwise, cancel
			if (active) {
				sendReplacedMessage(line, active, rl);
			} else {
				logError("No prior recipient found");
				rl.prompt();
			}
		} else {
			// Search for the group specified in the message
			const search = line.substring(0, terminator);
			getGroup(search, (err, group) => {
				if (!err) {
					// Send message to matched group
					sendReplacedMessage(line.substring(terminator + 1), group, rl);

					// Store the information of the last recipient so you don't have to specify it again
					active = group;

					// Update the prompt to indicate where messages are being sent by default
					rl.setPrompt(colored(`[${active.name}] `, "fggreen"));
				} else {
					logError(err);
				}
			});
		}
	});
}

/*
	Wrapper function for api.sendMessage that provides colored status prompts
	that indicate whether the message was sent properly.

	Provide a message, a threadId to send it to, and a readline interface to use
	for the status messages.
*/
function sendMessage(msg, threadId, rl, callback = () => { }, api = gapi) {
	api.sendMessage(msg, threadId, (err) => {
		if (!err) {
			newPrompt(colored("(sent)", "bggreen"), rl);
		} else {
			logError("(not sent)");
		}

		// Optional callback
		callback(err);
	});
}

/*
	Logs the specified error (`err`) in red to stdout.
*/
function logError(err) {
	console.log(colored(err, "bgred"));
}

/*
	Takes a search query (`query`) and looks for a thread with a matching name in
	the user's past 20 threads.

	Passes either an Error object or null and a Thread object matching the search
	to the specified callback.
*/
function getGroup(query, callback, api = gapi) {
	const search = new RegExp(query, "i"); // Case insensitive
	api.getThreadList(0, 10, "inbox", (err, threads) => {
		if (!err) {
			let found = false;
			for (let i = 0; i < threads.length; i++) {
				const id = threads[i].threadID;
				api.getThreadInfo(id, (err, info) => {
					if (!found && !err && info.name.search(search) > -1) {
						info.threadID = id;
						callback(null, info);
						found = true;
					}
				});
			}
		} else {
			callback(err);
		}
	});
}

/*
	Runs the specified message through a filterer to execute
	any special commands/replacements before sending the message.

	Takes a message to parse, a groupInfo object, and a readline Instance.
*/
function sendReplacedMessage(message, groupInfo, rl) {
	const msg = parseAndReplace(message, groupInfo);

	// parseAndReplace may return an empty message after replacement
	if (msg) {
		sendMessage(msg, groupInfo.threadID, rl); 
	}
}

/*
	Replaces special characters/commands in the given message with the info
	needed to send to Messenger.

	Takes a message and a groupInfo object to get the replacement data from.

	Returns the fixed string (which can be sent directly with sendMessage).
*/
function parseAndReplace(msg, groupInfo, api = gapi) {
	let fixed = msg;

	/*
 		List of fixes to make.

		Each fix should contain "match" and "replacement" fields to perform the replacement,
		and optionally can contain a "func" field containing a function to be called if a match
		is found. The groupInfo object, api instance, and match data will be passed to the function.
	*/
	const fixes = [
		{
			// {emoji} -> group emoji
			"match": /{emoji}/ig,
			"replacement": groupInfo.emoji ? groupInfo.emoji.emoji : "👍"
		},
		{
			// {read} -> ""; send read receipt
			"match": /{read}/i,
			"replacement": "",
			"func": (groupInfo, api) => {
				api.markAsRead(groupInfo.threadID, (err) => {
					if(!err) { newPrompt(colored("(read)", "bgblue"), rl); }
				});
			}
		},
		{
			// {bigemoji} -> send large group emoji
			"match": /{bigemoji}/i,
			"replacement": "",
			"func": (groupInfo, api) => {
				api.sendMessage({
					"emoji": groupInfo.emoji ? groupInfo.emoji.emoji : "👍 ",
					"emojiSize": "large"
				}, groupInfo.threadID, (err) => {
					if(!err) { newPrompt(colored("(emoji)", "bgyellow"), rl); }
				});
			}
		},
		{
			// {file|path/to/file} -> send file
			"match": /{file\|([^}]+)}/i,
			"replacement": "",
			"func": (groupInfo, api, match) => {
				const path = match[1];
				api.sendMessage({
					"attachment": fs.createReadStream(path)
				}, groupInfo.threadID, (err) => {
					if (!err) {
						newPrompt(colored("(image)", "bgcyan"), rl);
					} else {
						logError(`File not found at path ${path}`);
					}
				});
			}
		}
	]

	for (let i = 0; i < fixes.length; i++) {
		// Look for a match; if found, call the function if it exists
		let fix = fixes[i];
		if(msg.search(fix.match) > -1 && fix.func) {
			fix.func(groupInfo, api, msg.match(fix.match));
		}
		// Make the replacements as necessary
		fixed = fixed.replace(fix.match, fix.replacement);
	}

	return fixed.trim();
}

/*
	Clears the line of an existing prompt, logs the passed message, and then replaces the
	prompt for further messages.
*/
function newPrompt(msg, rl) {
	// Clear the line (prompt will be in front otherwise)
	readline.clearLine(process.stdout);
	readline.cursorTo(process.stdout, 0);

	// Log the message
	console.log(msg);

	// Replace the prompt
	rl.prompt();
}

