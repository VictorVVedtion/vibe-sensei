import os
import shutil

src_dir = '/Users/vvedition/.gemini/antigravity/brain/1f64714c-0cba-4463-bf6a-c79f5f623a82/'
dst_dir = '/Users/vvedition/Desktop/vibe-sensei/assets/sprites/'

if not os.path.exists(dst_dir):
    os.makedirs(dst_dir)

files = [f for f in os.listdir(src_dir) if f.endswith('.png')]

# Group by character and state, keeping the one with the highest timestamp
latest_files = {}

for f in files:
    try:
        # e.g. ray_dalio_idle_1775322669084.png -> ['ray', 'dalio', 'idle', '1775322669084']
        parts = f.replace('.png', '').split('_')
        
        if len(parts) >= 3:
            timestamp = int(parts[-1])
            state = parts[-2]
            char_name = '_'.join(parts[:-2])
            
            if state == 'celeb':
                state = 'celebrate'
                
            key = f"{char_name}-{state}"
            
            if key not in latest_files or latest_files[key]['timestamp'] < timestamp:
                latest_files[key] = {
                    'filename': f,
                    'timestamp': timestamp,
                    'char_name': char_name,
                    'state': state
                }
    except Exception as e:
        print(f"Skipping incorrectly formatted file: {f}")

copied_count = 0
for key, data in latest_files.items():
    src_path = os.path.join(src_dir, data['filename'])
    dst_name = f"{key}.png"
    dst_path = os.path.join(dst_dir, dst_name)
    shutil.copy2(src_path, dst_path)
    copied_count += 1
    print(f"✅ Copied {data['filename']} -> {dst_name}")

print(f"\n🎉 Successfully copied and renamed {copied_count} unique sprites to {dst_dir}")
