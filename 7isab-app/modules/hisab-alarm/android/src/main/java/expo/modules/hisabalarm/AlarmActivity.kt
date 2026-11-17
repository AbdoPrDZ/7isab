package expo.modules.hisabalarm

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.DateFormat
import java.util.Date

/**
 * The full-screen page over the lock screen: the time, what is ringing (e.g.
 * "Time for Asr"), Stop, and Snooze for alarms. Plain native views, so it
 * opens instantly without starting the app or reading its encrypted data.
 */
class AlarmActivity : Activity() {
  private val closeReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = finish()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val alarm = Alarm.fromJson(intent.getStringExtra(AlarmService.EXTRA_ALARM))
    if (alarm == null) {
      finish()
      return
    }
    setContentView(buildView(alarm))

    val filter = IntentFilter(AlarmService.ACTION_CLOSE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(closeReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(closeReceiver, filter)
    }
  }

  override fun onDestroy() {
    try {
      unregisterReceiver(closeReceiver)
    } catch (_: Exception) {
    }
    super.onDestroy()
  }

  private fun dp(value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  private fun text(value: String, size: Float, bold: Boolean = false, alpha: Int = 255) = TextView(this).apply {
    text = value
    setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    setTextColor(Color.argb(alpha, 255, 255, 255))
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  private fun button(label: String, filled: Boolean, onClick: () -> Unit) = Button(this).apply {
    text = label
    isAllCaps = false
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
    setTextColor(if (filled) GREEN else Color.WHITE)
    background = GradientDrawable().apply {
      cornerRadius = dp(28).toFloat()
      if (filled) setColor(Color.WHITE) else setStroke(dp(2), Color.WHITE)
    }
    setPadding(dp(24), dp(14), dp(24), dp(14))
    setOnClickListener { onClick() }
  }

  private fun buildView(alarm: Alarm): LinearLayout {
    val clock = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())
    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(GREEN)
      setPadding(dp(32), dp(48), dp(32), dp(48))

      addView(text(clock, 64f, bold = true))
      addView(text(alarm.title, 30f, bold = true).apply { setPadding(0, dp(24), 0, dp(8)) })
      if (alarm.body.isNotEmpty()) addView(text(alarm.body, 18f, alpha = 210))

      val buttons = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        .apply { topMargin = dp(20) }
      addView(
        button(alarm.stopLabel, filled = true) {
          AlarmService.stop(this@AlarmActivity)
          finish()
        },
        LinearLayout.LayoutParams(buttons).apply { topMargin = dp(56) },
      )
      if (alarm.snoozeMinutes > 0) {
        addView(
          button(alarm.snoozeLabel, filled = false) {
            AlarmService.snooze(this@AlarmActivity)
            finish()
          },
          buttons,
        )
      }
    }
  }

  companion object {
    private val GREEN = Color.rgb(0x0F, 0x5C, 0x45)

    fun intent(context: Context, alarm: Alarm): Intent =
      Intent(context, AlarmActivity::class.java)
        .putExtra(AlarmService.EXTRA_ALARM, alarm.toJson().toString())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
  }
}
