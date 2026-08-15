import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

export default function KioskSearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text || text.trim().length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/kiosk/employees', { params: { q: text.trim() } });
      setResults(data);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Text style={styles.header}>دوّر على اسمك</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="اكتب اسمك..."
        value={query}
        onChangeText={handleSearch}
        autoFocus
      />
      {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#2F80ED" />}
      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingTop: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultRow}
            onPress={() => navigation.navigate('KioskConfirm', { employee: item })}
          >
            <Text style={styles.resultName}>{item.name}</Text>
            <Text style={styles.resultMeta}>{item.position || ''}{item.shift ? ' - ' + item.shift.name : ''}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && query.length > 0 ? <Text style={styles.emptyText}>مفيش نتايج</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 20, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 16 },
  searchInput: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 14,
    fontSize: 16, textAlign: 'right'
  },
  resultRow: {
    backgroundColor: '#F5F7FA', borderRadius: 10, padding: 16, marginBottom: 10
  },
  resultName: { fontSize: 17, fontWeight: 'bold', color: '#111111', textAlign: 'right' },
  resultMeta: { fontSize: 13, color: '#777', textAlign: 'right', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30 }
});
