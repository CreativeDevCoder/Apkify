package app.apkify.shell.mod

import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialException
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import org.json.JSONObject

/**
 * Login Google native (Credential Manager). Mengembalikan ID token yang bisa dipakai di
 * Firebase Auth: signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).
 * Login Google di dalam WebView diblokir Google ("disallowed_useragent"), jadi ini jalannya.
 */
class GoogleAuthPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("google")
    override fun enabled(prefix: String) = cfg.on("googleSignIn")

    private val cm by lazy { CredentialManager.create(host) }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "signIn" -> {
                val clientId = a.str("clientId", cfg.section("google").str("webClientId"))
                if (!clientId.endsWith(".apps.googleusercontent.com")) return r.err("Web client ID Google belum diisi")
                // tombol "Sign in with Google" (selalu menampilkan pemilih akun); autoSelect=true -> bottom sheet One Tap
                val option = if (a.optBoolean("oneTap")) GetGoogleIdOption.Builder().setServerClientId(clientId).setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(a.optBoolean("autoSelect")).apply { a.str("nonce").takeIf { it.isNotEmpty() }?.let { setNonce(it) } }.build()
                    else GetSignInWithGoogleOption.Builder(clientId).apply { a.str("nonce").takeIf { it.isNotEmpty() }?.let { setNonce(it) } }.build()
                cm.getCredentialAsync(host, GetCredentialRequest.Builder().addCredentialOption(option).build(), CancellationSignal(), ContextCompat.getMainExecutor(host),
                    object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
                        override fun onResult(result: GetCredentialResponse) {
                            val c = result.credential
                            if (c is CustomCredential && c.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                                val g = GoogleIdTokenCredential.createFrom(c.data)
                                r.ok(JSONObject().put("idToken", g.idToken).put("id", g.id).put("name", g.displayName ?: "").put("givenName", g.givenName ?: "")
                                    .put("familyName", g.familyName ?: "").put("picture", g.profilePictureUri?.toString() ?: "").put("email", g.id))
                            } else r.err("kredensial tidak dikenal")
                        }
                        override fun onError(e: GetCredentialException) { r.err(e.message ?: e.type) }
                    })
            }
            "signOut" -> cm.clearCredentialStateAsync(ClearCredentialStateRequest(), CancellationSignal(), ContextCompat.getMainExecutor(host),
                object : CredentialManagerCallback<Void?, ClearCredentialException> {
                    override fun onResult(result: Void?) = r.ok()
                    override fun onError(e: ClearCredentialException) = r.err(e.message ?: "gagal")
                })
            else -> r.err("unknown google.$cmd")
        }
    }
}
