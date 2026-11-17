package expo.modules.hisabalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

/**
 * Plays the athan (once) or an alarm (looping) at alarm volume, as a media
 * foreground service. Its notification has a full-screen intent: on a locked
 * or sleeping phone Android opens AlarmActivity over the lock screen; while the
 * phone is in use it shows as a heads-up with Stop / Snooze.
 */
class AlarmService : Service() {
  private var player: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var current: Alarm? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { stopAll() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val alarm = Alarm.fromJson(intent.getStringExtra(EXTRA_ALARM)) ?: return stopEmpty()
        begin(alarm)
      }
      ACTION_STOP -> stopAll()
      ACTION_SNOOZE -> {
        current?.let { alarm ->
          if (alarm.snoozeMinutes > 0) {
            val again = alarm.copy(
              id = alarm.id.substringBefore(SNOOZE_MARK) + SNOOZE_MARK + System.currentTimeMillis(),
              time = System.currentTimeMillis() + alarm.snoozeMinutes * 60_000L,
            )
            AlarmScheduler.schedule(this, again)
          }
        }
        stopAll()
      }
      else -> return stopEmpty()
    }
    return START_NOT_STICKY
  }

  private fun stopEmpty(): Int {
    stopSelf()
    return START_NOT_STICKY
  }

  private fun begin(alarm: Alarm) {
    releasePlayer()
    current = alarm
    val notification = buildNotification(alarm)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hisab:alarm")
      .apply { acquire(MAX_RING_MS + 10_000L) }
    play(alarm)
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, MAX_RING_MS)
  }

  private fun soundUri(alarm: Alarm): Uri {
    if (alarm.sound.isNotEmpty()) {
      val id = resources.getIdentifier(alarm.sound, "raw", packageName)
      if (id != 0) return Uri.parse("android.resource://$packageName/$id")
    }
    return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
  }

  private fun play(alarm: Alarm) {
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@AlarmService, soundUri(alarm))
        isLooping = alarm.loop
        setOnCompletionListener { if (!alarm.loop) stopAll() }
        prepare()
        start()
      }
    } catch (_: Exception) {
      // No playable sound: the page and notification still show.
      releasePlayer()
    }
  }

  private fun releasePlayer() {
    player?.let {
      try {
        it.stop()
      } catch (_: Exception) {
      }
      it.release()
    }
    player = null
  }

  private fun stopAll() {
    handler.removeCallbacks(timeout)
    releasePlayer()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    current = null
    sendBroadcast(Intent(ACTION_CLOSE).setPackage(packageName))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    releasePlayer()
    wakeLock?.let { if (it.isHeld) it.release() }
    super.onDestroy()
  }

  private fun buildNotification(alarm: Alarm): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // The service plays the sound itself, so the channel is silent.
      val channel = NotificationChannel(CHANNEL_ID, "Athan & alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        setSound(null, null)
        enableVibration(true)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }

    val page = PendingIntent.getActivity(
      this,
      0,
      AlarmActivity.intent(this, alarm),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val stop = PendingIntent.getService(
      this,
      1,
      Intent(this, AlarmService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MAX)
    }
    builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(alarm.title)
      .setContentText(alarm.body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(page)
      .setFullScreenIntent(page, true)
      .addAction(Notification.Action.Builder(null, alarm.stopLabel, stop).build())

    if (alarm.snoozeMinutes > 0) {
      val snooze = PendingIntent.getService(
        this,
        2,
        Intent(this, AlarmService::class.java).setAction(ACTION_SNOOZE),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      builder.addAction(Notification.Action.Builder(null, alarm.snoozeLabel, snooze).build())
    }
    return builder.build()
  }

  companion object {
    const val ACTION_START = "expo.modules.hisabalarm.START"
    const val ACTION_STOP = "expo.modules.hisabalarm.STOP"
    const val ACTION_SNOOZE = "expo.modules.hisabalarm.SNOOZE"
    const val ACTION_CLOSE = "expo.modules.hisabalarm.CLOSE"
    const val EXTRA_ALARM = "alarm"
    private const val CHANNEL_ID = "hisab_alarm_screen"
    private const val NOTIFICATION_ID = 7_440
    private const val SNOOZE_MARK = ":snooze:"

    /** Stops by itself after this long (an alarm nobody stops, or a very long athan file). */
    private const val MAX_RING_MS = 10 * 60_000L

    fun start(context: Context, alarm: Alarm) {
      val intent = Intent(context, AlarmService::class.java)
        .setAction(ACTION_START)
        .putExtra(EXTRA_ALARM, alarm.toJson().toString())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      context.startService(Intent(context, AlarmService::class.java).setAction(ACTION_STOP))
    }

    fun snooze(context: Context) {
      context.startService(Intent(context, AlarmService::class.java).setAction(ACTION_SNOOZE))
    }
  }
}
