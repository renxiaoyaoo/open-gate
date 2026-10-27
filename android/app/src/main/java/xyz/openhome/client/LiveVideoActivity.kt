package xyz.openhome.client

import android.graphics.Color
import android.graphics.SurfaceTexture
import android.os.Bundle
import android.view.Gravity
import android.view.Surface
import android.view.TextureView
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.tencent.xnet.XP2P
import com.tencent.xnet.XP2PCallback
import tv.danmaku.ijk.media.player.IMediaPlayer
import tv.danmaku.ijk.media.player.IjkMediaPlayer

class LiveVideoActivity : AppCompatActivity(), XP2PCallback, TextureView.SurfaceTextureListener {
    private lateinit var texture: TextureView
    private lateinit var status: TextView
    private var surface: Surface? = null
    private var player: IjkMediaPlayer? = null
    private var productId = ""
    private var deviceName = ""
    private var xp2pInfo = ""
    private val deviceId get() = "$productId/$deviceName"

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        productId = intent.data?.getQueryParameter("productId").orEmpty()
        deviceName = intent.data?.getQueryParameter("deviceName").orEmpty()
        xp2pInfo = intent.data?.getQueryParameter("xp2pInfo").orEmpty()
        buildView()
        if (listOf(productId, deviceName, xp2pInfo).any { it.isBlank() }) {
            showStatus("实时视频配置不完整")
            return
        }
        XP2P.setLogEnable(false, false)
        XP2P.setCallback(this)
        showStatus("正在连接…")
        XP2P.startServiceWithXp2pInfo(deviceId, productId, deviceName, xp2pInfo)
    }

    private fun buildView() {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(23, 25, 22)) }
        texture = TextureView(this).also { it.surfaceTextureListener = this }
        status = TextView(this).apply { setTextColor(Color.WHITE); textSize = 15f; gravity = Gravity.CENTER; setPadding(32, 32, 32, 32) }
        root.addView(texture, FrameLayout.LayoutParams(-1, -1))
        root.addView(status, FrameLayout.LayoutParams(-1, -2, Gravity.CENTER))
        setContentView(root)
    }

    private fun showStatus(message: String) = runOnUiThread { status.text = message; status.visibility = android.view.View.VISIBLE }

    private fun play() = runOnUiThread {
        val targetSurface = surface ?: return@runOnUiThread
        val prefix = XP2P.delegateHttpFlv(deviceId)
        if (prefix.isBlank()) { showStatus("视频通道建立失败"); return@runOnUiThread }
        player?.release()
        player = IjkMediaPlayer().apply {
            setOption(IjkMediaPlayer.OPT_CATEGORY_FORMAT, "analyzemaxduration", 100)
            setOption(IjkMediaPlayer.OPT_CATEGORY_FORMAT, "probesize", 50 * 1024L)
            setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "packet-buffering", 0)
            setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "start-on-prepared", 1)
            setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "mediacodec", 1)
            setSurface(targetSurface)
            dataSource = prefix + "ipc.flv?action=live&channel=0&quality=standard"
            setOnPreparedListener { status.visibility = android.view.View.GONE; it.start() }
            setOnErrorListener { _: IMediaPlayer?, _: Int, _: Int -> showStatus("视频播放失败"); true }
            prepareAsync()
        }
    }

    override fun xp2pEventNotify(id: String?, msg: String?, event: Int) {
        when (event) { 1004 -> play(); 1003 -> showStatus("连接已断开"); 1010 -> showStatus("视频会话校验失败") }
    }
    override fun fail(msg: String?, errorCode: Int) = showStatus("连接失败")
    override fun commandRequest(id: String?, msg: String?) = Unit
    override fun avDataRecvHandle(id: String?, data: ByteArray?, len: Int) = Unit
    override fun avDataCloseHandle(id: String?, msg: String?, errorCode: Int) = showStatus("视频已停止")
    override fun onDeviceMsgArrived(id: String?, data: ByteArray?, len: Int) = ""
    override fun onSurfaceTextureAvailable(value: SurfaceTexture, width: Int, height: Int) { surface = Surface(value) }
    override fun onSurfaceTextureSizeChanged(value: SurfaceTexture, width: Int, height: Int) = Unit
    override fun onSurfaceTextureDestroyed(value: SurfaceTexture): Boolean { surface?.release(); surface = null; return true }
    override fun onSurfaceTextureUpdated(value: SurfaceTexture) = Unit

    override fun onDestroy() {
        player?.stop(); player?.release(); player = null
        if (productId.isNotBlank() && deviceName.isNotBlank()) XP2P.stopService(deviceId)
        surface?.release(); surface = null
        super.onDestroy()
    }
}
