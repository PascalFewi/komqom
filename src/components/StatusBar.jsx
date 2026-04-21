import React from 'react';

export default function StatusBar({ message }) {
  if (!message) return null;
  return (
    <div className={`status-bar status-bar-${message.type}`}>
      {message.text}
    </div>
  );
}
