import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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

// A horizontal row of 4 labeled buttons doesn't fit next to the title on a phone-width screen -
// the dropdown expands downward instead, where there's room for icon + label side by side.
const MENU_DROPDOWN_WIDTH = 190;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: addMenuOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [addMenuOpen, menuAnim]);
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
            Sign in on the Settings tab to see your pantry.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (item: InventoryItem) =>
    !trimmedQuery ||
    item.name.toLowerCase().includes(trimmedQuery) ||
    (item.category?.toLowerCase().includes(trimmedQuery) ?? false);

  const searchedItems = (items ?? []).filter(matchesSearch);
  const activeItems = searchedItems.filter((item) => !dismissedLowStock.has(item.id) || !isLowStock(item));
  const shelvedLowStock = searchedItems.filter((item) => dismissedLowStock.has(item.id) && isLowStock(item));
  const hasNoItemsAtAll = (items ?? []).length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {addMenuOpen && <Pressable style={styles.menuOverlay} onPress={() => setAddMenuOpen(false)} />}

        <View style={styles.header} pointerEvents="box-none">
          <ThemedText type="title" style={styles.title}>
            Pantry
          </ThemedText>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setAddMenuOpen((open) => !open)}
              disabled={identifying}
              hitSlop={6}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: theme.accent },
                pressed && styles.addButtonPressed,
              ]}>
              {identifying ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <Icon name={addMenuOpen ? 'xmark' : 'plus'} size={22} color={theme.accentText} />
              )}
            </Pressable>

            <Animated.View
              pointerEvents={addMenuOpen ? 'auto' : 'none'}
              style={[
                styles.dropdown,
                {
                  opacity: menuAnim,
                  transform: [
                    { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                    { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                  ],
                },
              ]}>
              <LabelCard style={styles.dropdownCard}>
                <MenuRow
                  icon="square.and.pencil"
                  label="Add manually"
                  onPress={() => {
                    setAddMenuOpen(false);
                    setForm(emptyForm);
                  }}
                />
                <MenuRow
                  icon="camera.fill"
                  label="Photo"
                  onPress={() => {
                    setAddMenuOpen(false);
                    onOpenCamera('identify');
                  }}
                />
                <MenuRow
                  icon="text.document.fill"
                  label="Receipt"
                  onPress={() => {
                    setAddMenuOpen(false);
                    onOpenCamera('receipt');
                  }}
                />
                <MenuRow
                  icon="barcode.viewfinder"
                  label="Barcode"
                  onPress={() => {
                    setAddMenuOpen(false);
                    onOpenCamera('barcode');
                  }}
                />
              </LabelCard>
            </Animated.View>
          </View>
        </View>

        {!hasNoItemsAtAll && (
          <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Icon name="magnifyingglass" size={16} color={theme.textSecondary} />
            <TextInput
              placeholder="Search pantry"
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={[styles.searchInput, { color: theme.text }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Icon name="xmark.circle.fill" size={16} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        )}

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
                <Icon
                  name={trimmedQuery ? 'magnifyingglass' : 'shippingbox'}
                  size={40}
                  color={theme.textSecondary}
                />
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {trimmedQuery
                    ? `No items match "${searchQuery.trim()}".`
                    : "Shelf's empty. Add your first item above."}
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

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}>
      <Icon name={icon} size={18} color={theme.text} />
      <ThemedText type="default">{label}</ThemedText>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    zIndex: 10,
  },
  title: {
    fontSize: 30,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: MENU_DROPDOWN_WIDTH,
  },
  dropdownCard: {
    gap: Spacing.half,
    padding: Spacing.two,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.label,
  },
  menuRowPressed: {
    opacity: 0.6,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.label,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.two,
    fontSize: 16,
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
