const login = require("facebook-chat-api");
const fs = require("fs");
const readline = require("readline");
const colored = require("./colors").colorString;
let gapi, last;

try {
	login({ "appState": JSON.parse(fs.readFileSync("appstate.json", "utf8")) }, callback);
} catch (e) {
	login({ "email": credentials.email, "password": credentials.password }, (err, api) => {
		if (err) return console.error(err);

		fs.writeFileSync("appstate.json", JSON.stringify(api.getAppState()));
		callback(err, api);
	});
}

function callback(err, api) {
	if (err) return console.error(err);
	api.setOptions({ "logLevel": "warn" });
	gapi = api;

	const rl = readline.createInterface({
		"input": process.stdin,
		"output": process.stdout
	});
	rl.setPrompt("> ");

	api.listen((err, msg) => {
		api.getThreadInfo(msg.threadID, (err, tinfo) => {
			api.getUserInfo(msg.senderID, (err, uinfo) => {
				console.log(`${colored(uinfo[msg.senderID].firstName, "fgblue")} in ${colored(tinfo.name, "fggreen")} ${msg.body}`);
			});
		});
	});

	rl.prompt();
	rl.on("line", (line) => {
		const terminator = line.indexOf(":");
		if (terminator == -1) {
			if (last) {
				api.sendMessage(line, last.threadId, (err) => {
					if (!err) { console.log(colored("sent", "bggreen")); } else { console.log(colored("(not sent)", "bgred")); }
				});
			} else {
				console.log("No prior chat");
			}
		} else {
			const search = line.substring(0, terminator);
			getGroup(search, (err, group) => {
				if (!err) {
					api.sendMessage(line.substring(terminator + 1), group.threadID, (err) => {
						if (!err) { console.log(colored("sent", "bggreen")); } else { console.log(colored("(not sent)", "bgred")); }
					});
					last = {
						"threadId": group.threadID,
						"name": group.name
					};
				} else {
					console.log(err);
				}
			});
		}
		rl.setPrompt(last ? colored(`[${last.name}] `, "fggreen") : "> ");
		rl.prompt();
	});
}

function getGroup(search, callback, api = gapi) {
	search = search.toLowerCase();
	api.getThreadList(0, 10, "inbox", (err, threads) => {
		if (!err) {
			for (let i = 0; i < threads.length; i++) {
				isCanonicalMatch(threads[i], search, (yes) => {
					if (threads[i].name.toLowerCase().indexOf(search) > -1 || yes) {
						callback(null, threads[i]);
						return;
					}
				});
			}
		} else {
			callback(err);
		}
	});
}

function isCanonicalMatch(thread, search, callback, api = gapi) {
	if (thread.isCanonical) {
		const users = thread.participantIDs;
		for (let i = 0; i < users.length; i++) {
			const cur = users[i];
			if (cur != api.getCurrentUserID()) {
				api.getUserInfo(cur, (err, info) => {
					if (info && info[cur].name.toLowerCase().indexOf(search) > -1) {
						callback(true);
					}
				});
			}
		}
	}
	callback(false);
}
