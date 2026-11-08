import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { AdminScreen } from '../screens/AdminScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ChatThreadScreen } from '../screens/ChatThreadScreen';
import { HrScreen } from '../screens/HrScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ShellScreen } from '../screens/ShellScreen';
import { useAuth } from '../state/AuthContext';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.midnight,
        },
        headerTintColor: Colors.parchment,
        headerTitleStyle: {
          fontWeight: '600',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Shell"
        component={ShellScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chats"
        component={ChatsScreen}
        options={{ title: 'All Conversations' }}
      />
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({
          title: route.params?.chatTitle || 'Chat Thread',
        })}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: 'Admin Console' }}
      />
      <Stack.Screen
        name="HR"
        component={HrScreen}
        options={{ title: 'HR Management' }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      // Default native navigation handles back navigation;
      // return false to allow system pop or exit when at root
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.ember} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
