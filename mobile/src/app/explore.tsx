import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  createInventoryItem,
  deleteInventoryItem,
  identifyPhoto,
  listInventory,
  lookupBarcode,
  parseReceipt,
  updateInventoryItem,
  type InventoryItem,
  type ParsedLineItem,
} from '@/lib/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

type FormState = {
  editingId: string | null;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  lowStockThreshold: string;
};

const emptyForm: FormState = {
  editingId: null,
  name: '',
  quantity: '1',
  unit: 'count',
  category: '',
  lowStockThreshold: '',
};

type CameraMode = 'identify' | 'receipt' | 'barcode';

type ReviewLineItem = ParsedLineItem & { included: boolean };

export default function InventoryScreen() {
  const { state: authState } = useAuth();
  const theme = useTheme();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('identify');
  const [identifying, setIdentifying] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [receiptReview, setReceiptReview] = useState<ReviewLineItem[] | null>(null);
  const [applyingReceipt, setApplyingReceipt] = useState(false);
  const barcodeLockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await listInventory();
      setItems(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inventory');
    }
  }, []);

  useEffect(() => {
    if (authState.status === 'signedIn') {
      load();
    }
  }, [authState.status, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const submitForm = useCallback(async () => {
    if (!form) return;
    const quantity = Number(form.quantity);
    if (!form.name.trim() || Number.isNaN(quantity) || quantity < 0) {
      setError('Enter a name and a non-negative quantity.');
      return;
    }
    const trimmedThreshold = form.lowStockThreshold.trim();
    const lowStockThreshold = trimmedThreshold ? Number(trimmedThreshold) : null;
    if (lowStockThreshold !== null && (Number.isNaN(lowStockThreshold) || lowStockThreshold < 0)) {
      setError('Low-stock threshold must be a non-negative number, or left blank.');
      return;
    }
    setSubmitting(true);
    try {
      const input = {
        name: form.name.trim(),
        quantity,
        unit: form.unit.trim() || 'count',
        category: form.category.trim() || null,
        lowStockThreshold,
      };
      if (form.editingId) {
        await updateInventoryItem(form.editingId, input);
      } else {
        await createInventoryItem(input);
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const onOpenCamera = useCallback(
    async (mode: CameraMode) => {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          setError('Camera permission is required to add items by photo.');
          return;
        }
      }
      setCameraMode(mode);
      barcodeLockRef.current = false;
      setCameraOpen(true);
    },
    [permission, requestPermission],
  );

  const onBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (barcodeLockRef.current) return;
    barcodeLockRef.current = true;
    setCameraOpen(false);
    setIdentifying(true);
    try {
      const found = await lookupBarcode(result.data);
      if (!found.found) {
        setError('Barcode not recognized. Try adding this item manually.');
        return;
      }
      setForm({
        editingId: null,
        name: found.name ?? '',
        quantity: '1',
        unit: found.defaultUnit ?? 'count',
        category: found.category ?? '',
        lowStockThreshold: '',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to look up barcode');
    } finally {
      setIdentifying(false);
    }
  }, []);

  const onCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setIdentifying(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) throw new Error('No photo captured');

      const context = ImageManipulator.manipulate(photo.uri);
      context.resize({ width: 800, height: null });
      const rendered = await context.renderAsync();
      const compressed = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.7,
        base64: true,
      });
      if (!compressed.base64) throw new Error('Failed to compress photo');

      setCameraOpen(false);

      if (cameraMode === 'receipt') {
        const parsed = await parseReceipt(compressed.base64, 'image/jpeg');
        if (parsed.items.length === 0) {
          setError('Could not read any items on that receipt. Try again with a clearer shot.');
          return;
        }
        setReceiptReview(parsed.items.map((item) => ({ ...item, included: true })));
        return;
      }

      const identified = await identifyPhoto(compressed.base64, 'image/jpeg');
      if (!identified.name) {
        setError('Could not identify an item in that photo. Try again with a clearer shot.');
        return;
      }
      setForm({
        editingId: null,
        name: identified.name,
        quantity: identified.estimatedQuantity ? String(identified.estimatedQuantity) : '1',
        unit: identified.unit ?? 'count',
        category: identified.category ?? '',
        lowStockThreshold: '',
      });
    } catch (err) {
      setCameraOpen(false);
      setError(err instanceof ApiError ? err.message : 'Failed to process photo');
    } finally {
      setIdentifying(false);
    }
  }, [cameraMode]);

  const toggleReviewItem = useCallback((index: number) => {
    setReceiptReview((current) =>
      current
        ? current.map((item, i) => (i === index ? { ...item, included: !item.included } : item))
        : current,
    );
  }, []);

  const onApplyReceipt = useCallback(async () => {
    if (!receiptReview) return;
    setApplyingReceipt(true);
    try {
      const toAdd = receiptReview.filter((item) => item.included);
      for (const item of toAdd) {
        await createInventoryItem({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? 'count',
          category: item.category ?? null,
        });
      }
      setReceiptReview(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add receipt items');
    } finally {
      setApplyingReceipt(false);
    }
  }, [receiptReview, load]);

  const onDelete = useCallback(
    async (item: InventoryItem) => {
      try {
        await deleteInventoryItem(item.id);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to delete item');
      }
    },
    [load],
  );

  if (authState.status !== 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ThemedText>Sign in on the Home tab to see your pantry.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Pantry
          </ThemedText>
          <ThemedView style={styles.headerActions}>
            <Pressable onPress={() => onOpenCamera('identify')} disabled={identifying}>
              <ThemedText type="linkPrimary">{identifying ? 'Working…' : '📷 Photo'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => onOpenCamera('receipt')} disabled={identifying}>
              <ThemedText type="linkPrimary">🧾 Receipt</ThemedText>
            </Pressable>
            <Pressable onPress={() => onOpenCamera('barcode')} disabled={identifying}>
              <ThemedText type="linkPrimary">🔖 Barcode</ThemedText>
            </Pressable>
            <Pressable onPress={() => setForm(emptyForm)}>
              <ThemedText type="linkPrimary">+ Add item</ThemedText>
            </Pressable>
          </ThemedView>
        </ThemedView>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {receiptReview && (
          <ThemedView type="backgroundElement" style={styles.form}>
            <ThemedText type="smallBold">Review receipt items</ThemedText>
            {receiptReview.map((item, index) => (
              <Pressable
                key={`${item.name}-${index}`}
                style={styles.reviewRow}
                onPress={() => toggleReviewItem(index)}>
                <ThemedText type="small">{item.included ? '☑' : '☐'}</ThemedText>
                <ThemedView style={styles.rowInfo}>
                  <ThemedText type="small">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantity ?? 1} {item.unit ?? 'count'}
                    {item.category ? ` · ${item.category}` : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            <ThemedView style={styles.formActions}>
              <Pressable onPress={() => setReceiptReview(null)}>
                <ThemedText type="link">Discard</ThemedText>
              </Pressable>
              <Pressable onPress={onApplyReceipt} disabled={applyingReceipt}>
                <ThemedText type="linkPrimary">
                  {applyingReceipt
                    ? 'Adding…'
                    : `Add ${receiptReview.filter((item) => item.included).length} items`}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}

        <Modal visible={cameraOpen} animationType="slide">
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={
                cameraMode === 'barcode'
                  ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }
                  : undefined
              }
              onBarcodeScanned={cameraMode === 'barcode' ? onBarcodeScanned : undefined}
            />
            <SafeAreaView style={styles.cameraControls}>
              <Pressable style={styles.cameraCancelButton} onPress={() => setCameraOpen(false)}>
                <ThemedText style={styles.cameraCancelText}>Cancel</ThemedText>
              </Pressable>
              {cameraMode === 'barcode' ? (
                <ThemedText style={styles.cameraCancelText}>Point at a barcode</ThemedText>
              ) : (
                <Pressable style={styles.captureButton} onPress={onCapture} />
              )}
            </SafeAreaView>
          </View>
        </Modal>

        {form && (
          <ThemedView type="backgroundElement" style={styles.form}>
            <TextInput
              placeholder="Name"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              style={[styles.input, { color: theme.text }]}
            />
            <TextInput
              placeholder="Quantity"
              value={form.quantity}
              onChangeText={(quantity) => setForm({ ...form, quantity })}
              keyboardType="numeric"
              style={[styles.input, { color: theme.text }]}
            />
            <TextInput
              placeholder="Unit (e.g. count, lbs, gallon)"
              value={form.unit}
              onChangeText={(unit) => setForm({ ...form, unit })}
              style={[styles.input, { color: theme.text }]}
            />
            <TextInput
              placeholder="Category (optional)"
              value={form.category}
              onChangeText={(category) => setForm({ ...form, category })}
              style={[styles.input, { color: theme.text }]}
            />
            <TextInput
              placeholder="Notify when quantity drops to (optional)"
              value={form.lowStockThreshold}
              onChangeText={(lowStockThreshold) => setForm({ ...form, lowStockThreshold })}
              keyboardType="numeric"
              style={[styles.input, { color: theme.text }]}
            />
            <ThemedView style={styles.formActions}>
              <Pressable onPress={() => setForm(null)}>
                <ThemedText type="link">Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={submitForm} disabled={submitting}>
                <ThemedText type="linkPrimary">{submitting ? 'Saving…' : 'Save'}</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        )}

        {items === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No items yet. Add your first one above.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedView style={styles.rowInfo}>
                  <ThemedText type="smallBold">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.quantity} {item.unit}
                    {item.category ? ` · ${item.category}` : ''}
                  </ThemedText>
                </ThemedView>
                <Pressable
                  onPress={() =>
                    setForm({
                      editingId: item.id,
                      name: item.name,
                      quantity: String(item.quantity),
                      unit: item.unit,
                      category: item.category ?? '',
                      lowStockThreshold:
                        item.lowStockThreshold != null ? String(item.lowStockThreshold) : '',
                    })
                  }>
                  <ThemedText type="link">Edit</ThemedText>
                </Pressable>
                <Pressable onPress={() => onDelete(item)}>
                  <ThemedText type="link" style={styles.deleteText}>
                    Delete
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraControls: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  cameraCancelButton: {
    alignSelf: 'flex-start',
  },
  cameraCancelText: {
    color: '#fff',
    fontSize: 16,
  },
  captureButton: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  error: {
    color: '#d33',
    marginBottom: Spacing.two,
  },
  form: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8884',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  deleteText: {
    color: '#d33',
  },
});
