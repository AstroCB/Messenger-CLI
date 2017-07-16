const login = require("facebook-chat-api");
const fs = require("fs");
const readline = require("readline");
const colored = require("./colors").colorString;
let gapi, last;

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
		let rl = initPrompt();
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
	const rl = readline.createInterface({
		"input": process.stdin,
		"output": process.stdout
	});
	rl.setPrompt("> ");
	return rl;
}

/*
	Main body of the CLI.
	
	Listens for new messages and logs them to stdout. Messages can be sent from
	stdin using the format described in README.md.
*/
function main(api) {
	// Use minimal logging from the API
	api.setOptions({ "logLevel": "warn" });
	// Initialize the global API object
	gapi = api;

	// Set up the prompt for sending new messages
	let rl = initPrompt();
	rl.prompt();

	// Listen to the stream of incoming messages and log them as they arrive
	api.listen((err, msg) => {
		api.getThreadInfo(msg.threadID, (err, tinfo) => {
			api.getUserInfo(msg.senderID, (err, uinfo) => {
				console.log(`${colored(uinfo[msg.senderID].firstName, "fgblue")} in ${colored(tinfo.name, "fggreen")} ${msg.body}`);
				rl.prompt();
			});
		});
	});

	// Watch stdin for new messages (terminated by newlines)
	rl.on("line", (line) => {
		const terminator = line.indexOf(":");
		if (terminator == -1) {
			// No recipient specified: send it to the last one messaged if available; otherwise, cancel
			if (last) {
				api.sendMessage(line, last.threadId, (err) => {
					if (!err) { console.log(colored("sent", "bggreen")); } else { logError("(not sent)"); }
				});
			} else {
				logError("No prior recipient found");
			}
		} else {
			// Search for the group specified in the message
			const search = line.substring(0, terminator);
			getGroup(search, (err, group) => {
				if (!err) {
					// Send message to matched group
					api.sendMessage(line.substring(terminator + 1), group.threadID, (err) => {
						if (!err) { console.log(colored("(sent)", "bggreen")); } else { logError("(not sent)"); }
					});
					let name = group.name;
					api.getThreadInfo(group, (err, info) => {
						console.log(info);
					})
					// Store the information of the last recipient so you don't have to specify it again
					last = {
						"threadId": group.threadID,
						"name": group.name || "PM"
					};

					// Update the prompt to indicate where messages are being sent by default
					rl.setPrompt(colored(`[${last.name}] `, "fggreen"));
				} else {
					logError(err);
				}
			});
		}
		// Prompt for next entry after every message
		rl.prompt();
	});
}

/*
	Logs the specified error (`err`) in red to stdout.
*/
function logError(err) {
	console.log(colored(err, "bgred"));
}

/*
	Takes a search query (`search`) and looks for a thread with a matching name in
	the user's past 20 threads.

	Passes either an Error object or null and a Thread object matching the search
	to the specified callback.
*/
function getGroup(search, callback, api = gapi) {
	search = search.toLowerCase();
	api.getThreadList(0, 20, "inbox", (err, threads) => {
		if (!err) {
			let found = false;
			for (let i = 0; i < threads.length; i++) {
				isCanonicalMatch(threads[i], search, (yes) => {
					const name = threads[i].name.toLowerCase();
					if (name.search(search) > -1 || yes) {
						if (!found) {
							callback(null, threads[i]);
							found = true;
							return;
						}
					}
				});
			}
		} else {
			callback(err);
		}
	});
}

/*
	Utility function that determines whether the passed `thread` object is both
	canonical (a one-on-one conversation) and whether the person that the thread
	is with (the other person in the conversation) matches the given `search` term.

	Passes a boolean to the callback indicating whether this match was found in hte
	provided thread.
*/
function isCanonicalMatch(thread, search, callback, api = gapi) {
	if (thread.isCanonical) {
		const users = thread.participantIDs;
		for (let i = 0; i < users.length; i++) {
			const cur = users[i];
			if (cur != api.getCurrentUserID()) {
				api.getUserInfo(cur, (err, info) => {
					if (info && info[cur].name.toLowerCase().search(search) > -1) {
						callback(true);
					}
				});
			}
		}
	}
	callback(false);
}
