'use client'; 

import { useState } from 'react';

export default function Announcement() {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    // 半透明黑色遮罩 + 微微的毛玻璃效果，显得更高级
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(3px)', 
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999 
    }}>
      
      {/* 弹窗本体：原版圆角和阴影 */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '12px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}>
        
        {/* 1. 标题区域：带原版那根灵魂的绿色短横线 */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
            🎬✨小徐影院公告✨🎬
          </h2>
          <div style={{ height: '2px', width: '32px', backgroundColor: '#1da055', marginTop: '8px' }}></div>
        </div>
        
        {/* 2. 内容区域：原版左侧绿条 + 浅绿色背景 */}
        <div style={{
          backgroundColor: '#f0fdf4',
          borderLeft: '4px solid #1da055',
          padding: '16px',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          marginBottom: '24px'
        }}>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '16px', lineHeight: '1.6' }}>
            ✨发现任何问题,请随时联系小徐✨
          </p>
        </div>

        {/* 3. 按钮区域：原版满宽绿色圆角按钮 */}
        <button 
          onClick={handleClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#1da055',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s' // 添加悬停过渡效果
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#168846'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1da055'}
        >
          开始观影
        </button>
        
      </div>
    </div>
  );
}
