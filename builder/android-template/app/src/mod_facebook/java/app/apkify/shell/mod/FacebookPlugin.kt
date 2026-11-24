package app.apkify.shell.mod

import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.strings
import org.json.JSONArray
import org.json.JSONObject

/** Login Facebook native: mengembalikan access token (pakai di Firebase: FacebookAuthProvider.credential(token)). */
class FacebookPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("facebook")
    override fun enabled(prefix: String) = cfg.on("facebookLogin")

    private val callbacks by lazy { CallbackManager.Factory.create() }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        val lm = LoginManager.getInstance()
        when (cmd) {
            "login" -> {
                lm.registerCallback(callbacks, object : FacebookCallback<LoginResult> {
                    override fun onSuccess(result: LoginResult) {
                        val t = result.accessToken
                        r.ok(JSONObject().put("accessToken", t.token).put("userId", t.userId).put("expires", t.expires.time)
                            .put("permissions", JSONArray(t.permissions.toList())).put("authenticationToken", result.authenticationToken?.token ?: ""))
                    }
                    override fun onCancel() = r.err("cancelled")
                    override fun onError(error: FacebookException) = r.err(error.message ?: "facebook error")
                })
                lm.logIn(host, callbacks, (a.optJSONArray("permissions") ?: JSONArray(listOf("public_profile", "email"))).strings())
            }
            "logout" -> { lm.logOut(); r.ok() }
            else -> r.err("unknown facebook.$cmd")
        }
    }
}
