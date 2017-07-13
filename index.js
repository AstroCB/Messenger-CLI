const login = require("facebook-chat-api");
const fs = require("fs");
const readline = require("readline");
let gapi, last;

try {
	login({"appState": JSON.parse(fs.readFileSync("appstate.json", "utf8"))}, callback);
} catch(e) {
	login({"email": "", "password": ""}, (err, api) => {
		if(err) return console.error(err);

		fs.writeFileSync("appstate.json", JSON.stringify(api.getAppState()));
		callback(err, api);
	});
}

function callback(err, api) {
	if(err) return console.error(err);
	api.setOptions({"logLevel": "warn"});
	gapi = api;

	const rl = readline.createInterface({
		"input": process.stdin,
		"output": process.stdout
	});
	rl.setPrompt("> ");
	
	api.listen((err, msg) => {
		api.getThreadInfo(msg.threadID, (err, tinfo) => {
			api.getUserInfo(msg.senderID, (err, uinfo) => {
				console.log(`\x1b[36m${uinfo[msg.senderID].firstName}\x1b[0m in \x1b[32m${tinfo.name}\x1b[0m: ${msg.body}`);
			});
		});
	});

	rl.prompt();
	rl.on("line", (line) => {
		const terminator = line.indexOf(":");
		if (terminator == -1) {
			if (last) {
				api.sendMessage(line, last, (err) => {
					if(!err) { console.log("\x1b[42m(sent)\x1b[0m"); } else { console.log("\x1b[41m(not sent)\x1b[0m"); }
				});
			} else {
				console.log("No prior chat");
			}
		} else {
			const search = line.substring(0, terminator);
			getGroup(search, (err, group) => {
				if (!err) {
					api.sendMessage(line.substring(terminator+1), group.threadID, (err) => {
						if (!err) { console.log("\x1b[42m(sent)\x1b[0m"); } else { console.log("\x1b[41m(not sent)\x1b[0m"); }
					});
					last = group.threadID;
				} else {
					console.log(err);
				}
			});
		}
		rl.prompt();
	});
}

function getGroup(search, callback, api = gapi) {
	search = search.toLowerCase();
	api.getThreadList(0, 10, "inbox", (err, threads) => {
		if(!err) {
			for(let i = 0; i < threads.length; i++) {
				isCanonicalMatch(threads[i], search, (yes) => {
					if(threads[i].name.toLowerCase().indexOf(search) > -1 || yes) {
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
	if(thread.isCanonical) {
		const users = thread.participantIDs;
		for(let i = 0; i < users.length; i++) {
			const cur = users[i];
			if(cur != api.getCurrentUserID()) {
				api.getUserInfo(cur, (err, info) => {
					if(info && info[cur].name.toLowerCase().indexOf(search) > -1){
						callback(true);
					}
				});
			}
		}
	}
	callback(false);
}
