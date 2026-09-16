import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
  type InventoryItem,
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
};

const emptyForm: FormState = { editingId: null, name: '', quantity: '1', unit: 'count', category: '' };

export default function InventoryScreen() {
  const { state: authState } = useAuth();
  const theme = useTheme();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const input = {
        name: form.name.trim(),
        quantity,
        unit: form.unit.trim() || 'count',
        category: form.category.trim() || null,
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
          <Pressable onPress={() => setForm(emptyForm)}>
            <ThemedText type="linkPrimary">+ Add item</ThemedText>
          </Pressable>
        </ThemedView>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
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
