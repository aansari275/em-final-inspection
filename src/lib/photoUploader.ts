import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { SizeInspectionFormState, PHOTO_TYPES, CONSTRUCTION_PHOTO_TYPES, NotOkPhoto } from '../types';
import { compressImage, withTimeout } from './imageUtils';

// Upload a single photo with compression and retry
async function uploadPhoto(file: File, path: string, retries = 2): Promise<string> {
  const compressed = await compressImage(file);
  const storageRef = ref(storage, path);
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await withTimeout(uploadBytes(storageRef, compressed), 60000, `Upload ${file.name}`);
      return await getDownloadURL(storageRef);
    } catch (err) {
      if (attempt <= retries) {
        console.warn(`Upload attempt ${attempt} failed for ${file.name}, retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Upload failed for ${file.name}`);
}

// Upload all photos for a single size inspection
async function uploadPhotosForSize(
  docId: string,
  sizeId: string,
  size: SizeInspectionFormState,
  onProgress: (completed: number, total: number) => void
): Promise<{
  standardPhotoUrls: Record<string, string>;
  constructionPhotoUrls: Record<string, string>;
  otherPhotoUrls: string[];
  stackedGoodsPhotoUrl: string;
  consumerPieces: Array<{ label: string; url: string }>;
  unitLoadPhotos: Array<{ label: string; url: string }>;
  notOkPhotos: NotOkPhoto[];
}> {
  // Collect all upload tasks for this size
  const tasks: Array<{ key: string; file: File; path: string; category: string; index?: number; label?: string }> = [];

  // Standard photos
  for (const pt of PHOTO_TYPES) {
    const file = size.standardPhotos[pt.key];
    if (file) {
      tasks.push({ key: pt.key, file, path: `final-inspection-images/${docId}/${sizeId}/${pt.key}_${file.name}`, category: 'standard' });
    }
  }

  // Construction photos
  for (const pt of CONSTRUCTION_PHOTO_TYPES) {
    const file = size.constructionPhotos[pt.key];
    if (file) {
      tasks.push({ key: `construction_${pt.key}`, file, path: `final-inspection-images/${docId}/${sizeId}/construction_${pt.key}_${file.name}`, category: 'construction', label: pt.key });
    }
  }

  // Stacked goods
  if (size.stackedGoodsPhoto) {
    tasks.push({ key: 'stacked_goods', file: size.stackedGoodsPhoto, path: `final-inspection-images/${docId}/${sizeId}/stacked_goods_${size.stackedGoodsPhoto.name}`, category: 'stacked' });
  }

  // Consumer pieces
  size.consumerPiecesForm.forEach((piece, i) => {
    if (piece.file && piece.label) {
      tasks.push({ key: `consumer_${i}`, file: piece.file, path: `final-inspection-images/${docId}/${sizeId}/consumer_${i}_${piece.file.name}`, category: 'consumer', index: i, label: piece.label });
    }
  });

  // Unit load
  if (size.unitLoadEnabled) {
    size.unitLoadPhotosForm.forEach((photo, i) => {
      if (photo.file && photo.label) {
        tasks.push({ key: `unitload_${i}`, file: photo.file, path: `final-inspection-images/${docId}/${sizeId}/unitload_${i}_${photo.file.name}`, category: 'unitload', index: i, label: photo.label });
      }
    });
  }

  // NOT OK photos
  for (const [fieldKey, file] of Object.entries(size.notOkPhotosForm)) {
    if (file) {
      tasks.push({ key: `notok_${fieldKey}`, file, path: `final-inspection-images/${docId}/${sizeId}/notok_${fieldKey}_${file.name}`, category: 'notok', label: fieldKey });
    }
  }

  // Other photos
  size.otherPhotos.forEach((file, i) => {
    tasks.push({ key: `other_${i}`, file, path: `final-inspection-images/${docId}/${sizeId}/other_${i}_${file.name}`, category: 'other', index: i });
  });

  // Upload in batches of 8
  const results = new Map<string, string>();
  let completed = 0;
  const BATCH_SIZE = 8;

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (task) => {
        const url = await uploadPhoto(task.file, task.path);
        completed++;
        onProgress(completed, tasks.length);
        return { key: task.key, url };
      })
    );

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.set(result.value.key, result.value.url);
      } else {
        completed++;
        console.error(`Failed to upload ${batch[idx].key}:`, result.reason);
        onProgress(completed, tasks.length);
      }
    });
  }

  // Map results back to structured objects
  const standardPhotoUrls: Record<string, string> = {};
  for (const pt of PHOTO_TYPES) {
    if (results.has(pt.key)) standardPhotoUrls[pt.key] = results.get(pt.key)!;
  }

  const constructionPhotoUrls: Record<string, string> = {};
  for (const pt of CONSTRUCTION_PHOTO_TYPES) {
    if (results.has(`construction_${pt.key}`)) constructionPhotoUrls[pt.key] = results.get(`construction_${pt.key}`)!;
  }

  const otherPhotoUrls = size.otherPhotos.map((_, i) => results.get(`other_${i}`) || '').filter(Boolean);
  const stackedGoodsPhotoUrl = results.get('stacked_goods') || '';

  const consumerPieces = size.consumerPiecesForm
    .map((piece, i) => ({ label: piece.label, url: results.get(`consumer_${i}`) || '' }))
    .filter(p => p.url && p.label);

  const unitLoadPhotos = size.unitLoadEnabled
    ? size.unitLoadPhotosForm
        .map((photo, i) => ({ label: photo.label, url: results.get(`unitload_${i}`) || '' }))
        .filter(p => p.url && p.label)
    : [];

  const notOkPhotos: NotOkPhoto[] = Object.keys(size.notOkPhotosForm)
    .filter(fieldKey => size.notOkPhotosForm[fieldKey] && results.has(`notok_${fieldKey}`))
    .map(fieldKey => ({ field: fieldKey, photo: results.get(`notok_${fieldKey}`)! }));

  return { standardPhotoUrls, constructionPhotoUrls, otherPhotoUrls, stackedGoodsPhotoUrl, consumerPieces, unitLoadPhotos, notOkPhotos };
}

// Count total photos across all size inspections
export function countTotalPhotos(sizes: SizeInspectionFormState[]): number {
  let count = 0;
  for (const size of sizes) {
    for (const pt of PHOTO_TYPES) {
      if (size.standardPhotos[pt.key]) count++;
    }
    for (const pt of CONSTRUCTION_PHOTO_TYPES) {
      if (size.constructionPhotos[pt.key]) count++;
    }
    count += size.otherPhotos.length;
    count += Object.values(size.notOkPhotosForm).filter(Boolean).length;
    if (size.stackedGoodsPhoto) count++;
    count += size.consumerPiecesForm.filter(p => p.file).length;
    if (size.unitLoadEnabled) count += size.unitLoadPhotosForm.filter(p => p.file).length;
  }
  return count;
}

// Main background upload function
// Called after Firestore document is saved with empty photo URLs
export async function uploadPhotosInBackground(
  docId: string,
  sizeInspections: SizeInspectionFormState[],
  onProgress: (message: string) => void,
  onStatusUpdate: (status: 'uploading' | 'complete' | 'partial') => void
): Promise<void> {
  try {
    // Update status to uploading
    await updateDoc(doc(db, 'final-inspections', docId), { photoUploadStatus: 'uploading' });
    onStatusUpdate('uploading');

    let totalUploaded = 0;
    let totalFailed = 0;
    const totalPhotos = countTotalPhotos(sizeInspections);

    if (totalPhotos === 0) {
      await updateDoc(doc(db, 'final-inspections', docId), {
        photoUploadStatus: 'complete',
        uploadedPhotoCount: 0
      });
      onStatusUpdate('complete');
      return;
    }

    onProgress(`Uploading 0/${totalPhotos} photos...`);

    // Process each size sequentially (to avoid overwhelming the connection)
    for (let i = 0; i < sizeInspections.length; i++) {
      const size = sizeInspections[i];

      onProgress(`Uploading photos for size ${size.size || i + 1} (${totalUploaded}/${totalPhotos})...`);

      const photoResults = await uploadPhotosForSize(
        docId,
        size.id,
        size,
        (completed, _sizeTotal) => {
          onProgress(`Uploading ${totalUploaded + completed}/${totalPhotos} photos (size ${size.size || i + 1})...`);
        }
      );

      // Count what was uploaded for this size
      const sizeUploadCount = Object.keys(photoResults.standardPhotoUrls).length +
        Object.keys(photoResults.constructionPhotoUrls).length +
        photoResults.otherPhotoUrls.length +
        (photoResults.stackedGoodsPhotoUrl ? 1 : 0) +
        photoResults.consumerPieces.length +
        photoResults.unitLoadPhotos.length +
        photoResults.notOkPhotos.length;

      totalUploaded += sizeUploadCount;

      // Read current doc, update this size's photos, write back
      const currentDoc = await getDoc(doc(db, 'final-inspections', docId));
      if (currentDoc.exists()) {
        const data = currentDoc.data();
        const sizes = [...(data.sizeInspections || [])];
        if (sizes[i]) {
          sizes[i] = {
            ...sizes[i],
            standardPhotoUrls: photoResults.standardPhotoUrls,
            constructionPhotoUrls: photoResults.constructionPhotoUrls,
            otherPhotoUrls: photoResults.otherPhotoUrls,
            stackedGoodsPhotoUrl: photoResults.stackedGoodsPhotoUrl,
            consumerPieces: photoResults.consumerPieces,
            unitLoadPhotos: photoResults.unitLoadPhotos,
            notOkPhotos: photoResults.notOkPhotos,
          };
        }
        await updateDoc(doc(db, 'final-inspections', docId), {
          sizeInspections: sizes,
          uploadedPhotoCount: totalUploaded,
        });
      }
    }

    // Final status
    const finalStatus = totalFailed > 0 ? 'partial' : 'complete';
    await updateDoc(doc(db, 'final-inspections', docId), {
      photoUploadStatus: finalStatus,
      uploadedPhotoCount: totalUploaded,
      totalPhotoCount: totalPhotos,
    });
    onStatusUpdate(finalStatus);

    console.log(`[Final Inspection] Photo upload complete: ${totalUploaded}/${totalPhotos} uploaded`);

  } catch (error) {
    console.error('[Final Inspection] Background upload error:', error);
    try {
      await updateDoc(doc(db, 'final-inspections', docId), { photoUploadStatus: 'partial' });
    } catch {} // ignore update failure
    onStatusUpdate('partial');
  }
}
