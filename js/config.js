// Settings for the web page.

// ntfy.sh topics are PUBLIC: anyone who knows the name can read and post to it.
// That's why this is a long random name. Your friends subscribe to this exact
// topic in the ntfy app. Note that anyone who views your site's source can see it,
// so never send private info through it.
const NTFY_TOPIC = "tabletap-4bf7497cc047d1878a";

// How long to wait before the same location can notify again (5 minutes).
const COOLDOWN_MS = 5 * 60 * 1000;
