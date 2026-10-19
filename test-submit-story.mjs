import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fivighqyyxlhjhicuwvv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdmlnaHF5eXhsaGpoaWN1d3Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNzQ5MDQsImV4cCI6MjEwNzk1MDkwNH0.Yu3o2jvrBa4VTC5dpIajjNBJltUyxkyKLze9PhxB5Uw'
);

const { data, error } = await supabase.rpc('submit_story', {
  identity: { profession: '软件工程师', city: '北京', origin: '测试', age: '26-30' },
  story: '这是 Cloud Agent 自动化测试提交的故事。今天通过自动化测试验证了 submit_story RPC 功能正常工作。当时使用 Playwright 测试页面渲染。后来直接调用 RPC 验证数据提交。我学到了完整的端到端测试很重要。'
});

if (error) {
  console.error('✗ Submission failed:', error.message);
  process.exit(1);
}

console.log('✓ Story submitted successfully');
console.log('Submission ID:', data);
