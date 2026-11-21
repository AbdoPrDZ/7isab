/**
 * Profile photo. Picked from the gallery or the camera, cropped square,
 * resized to PHOTO_SIZE and kept as a JPEG data URI in one vault record, so
 * it is encrypted on the phone and synced like every other record (the server
 * only sees ciphertext).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { deterministicId, putDoc, removeDoc, useDocs, type Doc } from '@/lib/data/vault';
import { RecordTypes } from '@/lib/ledger/types';

export type Profile = Doc & { photo: string };

/** Width and height of the stored photo, in pixels. */
export const PHOTO_SIZE = 256;

function profileId(): string {
  return deterministicId('profile:me');
}

/** The photo as a data URI, or null when there is none. */
export function useProfilePhoto(): string | null {
  const docs = useDocs<Profile>(RecordTypes.profile);
  return docs.find((doc) => doc.id === profileId())?.photo ?? null;
}

export type PhotoSource = 'library' | 'camera';

export type PickResult = 'saved' | 'canceled' | 'denied';

/** Lets the user pick and crop a photo, then saves it. */
export async function pickProfilePhoto(source: PhotoSource): Promise<PickResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return 'canceled';

  const image = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: PHOTO_SIZE, height: PHOTO_SIZE }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!saved.base64) throw new Error('The photo could not be read.');
  await putDoc<Profile>(RecordTypes.profile, { id: profileId(), photo: `data:image/jpeg;base64,${saved.base64}` });
  return 'saved';
}

export async function removeProfilePhoto(): Promise<void> {
  await removeDoc(RecordTypes.profile, profileId());
}
