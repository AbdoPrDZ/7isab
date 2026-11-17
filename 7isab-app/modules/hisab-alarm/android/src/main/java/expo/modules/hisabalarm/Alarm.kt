package expo.modules.hisabalarm

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * One scheduled ring: an athan (plays once) or an alarm (loops until stopped,
 * can snooze). Only display text and timing are stored, never the user's data.
 */
data class Alarm(
  val id: String,
  val time: Long,
  val title: String,
  val body: String,
  /** Raw resource name of the sound (e.g. "makkah"); empty = the phone's alarm sound. */
  val sound: String,
  val loop: Boolean,
  val snoozeMinutes: Int,
  val stopLabel: String,
  val snoozeLabel: String,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("time", time)
    .put("title", title)
    .put("body", body)
    .put("sound", sound)
    .put("loop", loop)
    .put("snoozeMinutes", snoozeMinutes)
    .put("stopLabel", stopLabel)
    .put("snoozeLabel", snoozeLabel)

  companion object {
    fun fromJson(json: JSONObject) = Alarm(
      id = json.getString("id"),
      time = json.getLong("time"),
      title = json.optString("title"),
      body = json.optString("body"),
      sound = json.optString("sound"),
      loop = json.optBoolean("loop"),
      snoozeMinutes = json.optInt("snoozeMinutes"),
      stopLabel = json.optString("stopLabel", "Stop"),
      snoozeLabel = json.optString("snoozeLabel", "Snooze"),
    )

    fun fromJson(text: String?): Alarm? = try {
      if (text == null) null else fromJson(JSONObject(text))
    } catch (_: Exception) {
      null
    }
  }
}

/** The scheduled rings, kept so they can be set again after a restart. */
object AlarmStore {
  private const val PREFS = "hisab_alarm"
  private const val KEY = "alarms"

  @Synchronized
  fun all(context: Context): List<Alarm> {
    val text = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    return try {
      val array = JSONArray(text)
      (0 until array.length()).map { Alarm.fromJson(array.getJSONObject(it)) }
    } catch (_: Exception) {
      emptyList()
    }
  }

  @Synchronized
  private fun save(context: Context, alarms: List<Alarm>) {
    val array = JSONArray()
    alarms.forEach { array.put(it.toJson()) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, array.toString()).apply()
  }

  @Synchronized
  fun put(context: Context, alarm: Alarm) = save(context, all(context).filter { it.id != alarm.id } + alarm)

  @Synchronized
  fun remove(context: Context, id: String) = save(context, all(context).filter { it.id != id })

  @Synchronized
  fun get(context: Context, id: String): Alarm? = all(context).firstOrNull { it.id == id }
}
