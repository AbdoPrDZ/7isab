package expo.modules.hisabalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** A ring as sent from JavaScript. */
class AlarmSpec : Record {
  @Field val id: String = ""
  @Field val time: Double = 0.0
  @Field val title: String = ""
  @Field val body: String = ""
  @Field val sound: String = ""
  @Field val loop: Boolean = false
  @Field val snoozeMinutes: Int = 0
  @Field val stopLabel: String = "Stop"
  @Field val snoozeLabel: String = "Snooze"

  fun toAlarm() = Alarm(id, time.toLong(), title, body, sound, loop, snoozeMinutes, stopLabel, snoozeLabel)
}

/**
 * HisabAlarm: athan and alarms that ring like an alarm clock — exact, with a
 * full-screen page over the lock screen, even when the app is closed.
 */
class HisabAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("HisabAlarm")

    /** Schedules rings (replacing any with the same id). */
    Function("schedule") { alarms: List<AlarmSpec> ->
      alarms.forEach { AlarmScheduler.schedule(context, it.toAlarm()) }
    }

    /** Cancels every ring whose id starts with `prefix` (e.g. "athan:"). */
    Function("cancelPrefix") { prefix: String ->
      AlarmScheduler.cancelPrefix(context, prefix)
    }

    /** Ids of the rings still scheduled. */
    Function("scheduledIds") {
      AlarmStore.all(context).map { it.id }
    }

    Function("canScheduleExact") {
      AlarmScheduler.canScheduleExact(context)
    }

    /** Android 14+: full-screen pages need a special permission the user can turn off. */
    Function("canUseFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openFullScreenSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 34) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    /** Rings now (to test the page and the sound). */
    Function("ringNow") { alarm: AlarmSpec ->
      AlarmService.start(context, alarm.toAlarm())
    }
  }
}
