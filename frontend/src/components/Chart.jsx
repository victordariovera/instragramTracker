import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

function Chart({ data, dataKey, title, color, compact = false }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '20px' : '40px', color: '#8e8e8e' }}>
        No data available yet
      </div>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    displayDate: format(parseISO(item.date), 'MMM d')
  }));

  return (
    <div>
      {!compact && (
        <h3 style={{ fontSize: '16px', marginBottom: '16px', fontWeight: '600' }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={compact ? 200 : 250}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#efefef" />
          <XAxis 
            dataKey="displayDate" 
            tick={{ fontSize: compact ? 10 : 12 }}
            stroke="#8e8e8e"
            angle={compact ? -45 : 0}
            textAnchor={compact ? 'end' : 'middle'}
            height={compact ? 60 : 30}
          />
          <YAxis 
            tick={{ fontSize: compact ? 10 : 12 }}
            stroke="#8e8e8e"
            width={compact ? 50 : 60}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #dbdbdb',
              borderRadius: '4px',
              fontSize: compact ? '12px' : '14px'
            }}
          />
          {!compact && <Legend />}
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            dot={{ r: compact ? 3 : 4 }}
            activeDot={{ r: compact ? 5 : 6 }}
            name={compact ? '' : 'Daily Change'}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Chart;