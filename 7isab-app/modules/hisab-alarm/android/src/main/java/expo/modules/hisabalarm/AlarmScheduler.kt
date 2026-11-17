package expo.modules.hisabalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * Schedules rings with AlarmManager.setAlarmClock: exact, not delayed by
 * battery saving, and allowed to start the sound service from the background.
 */
object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.hisabalarm.FIRE"
  const val EXTRA_ID = "id"

  private fun fireIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("hisab-alarm://ring/" + Uri.encode(id)))
      .putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Opens the app when the user taps the alarm icon in the status bar. */
  private fun showIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  fun schedule(context: Context, alarm: Alarm) {
    if (alarm.time <= System.currentTimeMillis()) return
    AlarmStore.put(context, alarm)
    set(context, alarm)
  }

  private fun set(context: Context, alarm: Alarm) {
    val manager = context.getSystemService(AlarmManager::class.java)
    val operation = fireIntent(context, alarm.id)
    if (canScheduleExact(context)) {
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(alarm.time, showIntent(context)), operation)
    } else {
      // Without the exact-alarm permission: as close as Android allows.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.time, operation)
    }
  }

  fun cancel(context: Context, id: String) {
    context.getSystemService(AlarmManager::class.java).cancel(fireIntent(context, id))
    AlarmStore.remove(context, id)
  }

  fun cancelPrefix(context: Context, prefix: String) {
    AlarmStore.all(context).filter { it.id.startsWith(prefix) }.forEach { cancel(context, it.id) }
  }

  /** After a restart (alarms are cleared by Android) or a clock change: set every future ring again. */
  fun rescheduleAll(context: Context) {
    val now = System.currentTimeMillis()
    AlarmStore.all(context).forEach { alarm ->
      if (alarm.time > now) set(context, alarm) else AlarmStore.remove(context, alarm.id)
    }
  }
}

/** Fires a ring: starts the sound service, which shows the full-screen page. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmScheduler.ACTION_FIRE) return
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val alarm = AlarmStore.get(context, id) ?: return
    AlarmStore.remove(context, id)
    AlarmService.start(context, alarm)
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.rescheduleAll(context)
  }
}
