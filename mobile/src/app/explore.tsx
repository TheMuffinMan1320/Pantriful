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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { Icon } from '@/components/icon';
import { LabelCard } from '@/components/label-card';
import { StampBadge } from '@/components/stamp-badge';
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
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
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

function isLowStock(item: InventoryItem): boolean {
  return item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
}

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
  const [dismissedLowStock, setDismissedLowStock] = useState<Set<string>>(new Set());
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

  const openEdit = useCallback((item: InventoryItem) => {
    setForm({
      editingId: item.id,
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      category: item.category ?? '',
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : '',
    });
  }, []);

  if (authState.status !== 'signedIn') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <Icon name="person.crop.circle.badge.questionmark" size={40} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            Sign in on the Home tab to see your pantry.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const activeItems = (items ?? []).filter((item) => !dismissedLowStock.has(item.id) || !isLowStock(item));
  const shelvedLowStock = (items ?? []).filter((item) => dismissedLowStock.has(item.id) && isLowStock(item));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Pantry
          </ThemedText>
          <View style={styles.headerActions}>
            <ActionButton
              icon="camera.fill"
              label={identifying ? 'Working' : 'Photo'}
              onPress={() => onOpenCamera('identify')}
              disabled={identifying}
            />
            <ActionButton
              icon="text.document.fill"
              label="Receipt"
              onPress={() => onOpenCamera('receipt')}
              disabled={identifying}
            />
            <ActionButton
              icon="barcode.viewfinder"
              label="Barcode"
              onPress={() => onOpenCamera('barcode')}
              disabled={identifying}
            />
            <ActionButton icon="plus" label="Add" onPress={() => setForm(emptyForm)} accent />
          </View>
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {receiptReview && (
          <LabelCard style={styles.form}>
            <ThemedText type="subtitle">Review receipt</ThemedText>
            {receiptReview.map((item, index) => (
              <Pressable
                key={`${item.name}-${index}`}
                style={styles.reviewRow}
                onPress={() => toggleReviewItem(index)}>
                <Icon
                  name={item.included ? 'checkmark.circle.fill' : 'circle'}
                  size={22}
                  color={item.included ? theme.fresh : theme.textSecondary}
                />
                <View style={styles.rowInfo}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText type="data" themeColor="textSecondary">
                    {item.quantity ?? 1} {item.unit ?? 'count'}
                    {item.category ? ` · ${item.category}` : ''}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
            <View style={styles.formActions}>
              <Pressable onPress={() => setReceiptReview(null)} hitSlop={8}>
                <ThemedText type="link">Discard</ThemedText>
              </Pressable>
              <Pressable onPress={onApplyReceipt} disabled={applyingReceipt} hitSlop={8}>
                <ThemedText type="linkPrimary">
                  {applyingReceipt
                    ? 'Adding…'
                    : `Add ${receiptReview.filter((item) => item.included).length} items`}
                </ThemedText>
              </Pressable>
            </View>
          </LabelCard>
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
          <LabelCard style={styles.form}>
            <ThemedText type="subtitle">{form.editingId ? 'Edit item' : 'Add item'}</ThemedText>
            <LabeledInput label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
            <View style={styles.inputPair}>
              <LabeledInput
                label="Quantity"
                value={form.quantity}
                onChangeText={(quantity) => setForm({ ...form, quantity })}
                keyboardType="numeric"
                data
                style={styles.inputFlex}
              />
              <LabeledInput
                label="Unit"
                value={form.unit}
                onChangeText={(unit) => setForm({ ...form, unit })}
                style={styles.inputFlex}
              />
            </View>
            <LabeledInput
              label="Category (optional)"
              value={form.category}
              onChangeText={(category) => setForm({ ...form, category })}
            />
            <LabeledInput
              label="Notify when quantity drops to (optional)"
              value={form.lowStockThreshold}
              onChangeText={(lowStockThreshold) => setForm({ ...form, lowStockThreshold })}
              keyboardType="numeric"
              data
            />
            <View style={styles.formActions}>
              <Pressable onPress={() => setForm(null)} hitSlop={8}>
                <ThemedText type="link">Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={submitForm} disabled={submitting} hitSlop={8}>
                <ThemedText type="linkPrimary">{submitting ? 'Saving…' : 'Save'}</ThemedText>
              </Pressable>
            </View>
          </LabelCard>
        )}

        {items === null ? (
          <ActivityIndicator style={styles.loading} color={theme.accent} />
        ) : (
          <FlatList
            data={activeItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="shippingbox" size={40} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  Shelf's empty. Add your first item above.
                </ThemedText>
              </View>
            }
            ListFooterComponent={
              shelvedLowStock.length > 0 ? (
                <View style={styles.tray}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Set aside · {shelvedLowStock.length}
                  </ThemedText>
                  {shelvedLowStock.map((item) => (
                    <View key={item.id} style={styles.trayRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.trayName}>
                        {item.name}
                      </ThemedText>
                      <Pressable
                        onPress={() =>
                          setDismissedLowStock((prev) => {
                            const next = new Set(prev);
                            next.delete(item.id);
                            return next;
                          })
                        }
                        hitSlop={8}>
                        <ThemedText type="link">Restore</ThemedText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const low = isLowStock(item);
              return (
                <LabelCard style={styles.row}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowInfo}>
                      <ThemedText
                        type={low ? 'title' : 'smallBold'}
                        style={low ? styles.lowStockName : undefined}
                        numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <BarcodeRule seed={item.id} height={10} />
                      <View style={styles.rowMeta}>
                        <ThemedText type="data" themeColor="textSecondary">
                          {item.quantity} {item.unit}
                        </ThemedText>
                        {item.category && (
                          <ThemedText type="label" themeColor="textSecondary">
                            {item.category}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    {low && (
                      <Pressable
                        onPress={() => setDismissedLowStock((prev) => new Set(prev).add(item.id))}
                        hitSlop={8}>
                        <StampBadge label="LOW" />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.rowActionButton}>
                      <Icon name="pencil" size={16} color={theme.textSecondary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Edit
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.rowActionButton}>
                      <Icon name="trash" size={16} color={theme.danger} />
                      <ThemedText type="small" themeColor="danger">
                        Delete
                      </ThemedText>
                    </Pressable>
                  </View>
                </LabelCard>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  accent,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}>
      <View
        style={[
          styles.actionIconWrap,
          { backgroundColor: accent ? theme.accent : theme.backgroundElement, borderColor: theme.border },
        ]}>
        <Icon name={icon} size={18} color={accent ? theme.accentText : theme.text} />
      </View>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  data,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'numeric' | 'default';
  data?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={style}>
      <ThemedText type="label" themeColor="textSecondary" style={styles.inputLabel}>
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, fontFamily: data ? 'SpaceMono_400Regular' : undefined },
        ]}
      />
    </View>
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
    gap: Spacing.three,
  },
  centeredText: {
    textAlign: 'center',
  },
  header: {
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  actionButton: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.label,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
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
    marginBottom: Spacing.two,
  },
  form: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  inputPair: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  inputFlex: {
    flex: 1,
  },
  inputLabel: {
    marginBottom: Spacing.half,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.label,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.four,
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
    gap: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
  tray: {
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  trayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trayName: {
    flex: 1,
    textDecorationLine: 'line-through',
  },
  row: {
    gap: Spacing.three,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.one,
  },
  lowStockName: {
    fontSize: 22,
    lineHeight: 26,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  rowActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
