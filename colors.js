const colors = exports.colors = {
    "reset": "\x1b[0m",
    "bright": "\x1b[1m",
    "dim": "\x1b[2m",
    "underscore": "\x1b[4m",
    "blink": "\x1b[5m",
    "reverse": "\x1b[7m",
    "hidden": "\x1b[8m",
    "fgblack": "\x1b[30m",
    "fgred": "\x1b[31m",
    "fggreen": "\x1b[32m",
    "fgyellow": "\x1b[33m",
    "fgblue": "\x1b[34m",
    "fgmagenta": "\x1b[35m",
    "fgcyan": "\x1b[36m",
    "fgwhite": "\x1b[37m",
    "bgblack": "\x1b[40m",
    "bgred": "\x1b[41m",
    "bggreen": "\x1b[42m",
    "bgyellow": "\x1b[43m",
    "bgblue": "\x1b[44m",
    "bgmagenta": "\x1b[45m",
    "bgcyan": "\x1b[46m",
    "bgwhite": "\x1b[47m",
};

exports.colorString = (string, color) => {
    return `${colors[color]}${string}${colors.reset}`;
};