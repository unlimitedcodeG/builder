<!--
 * @Author: Zhang zhiyang
 * @Date: 2024-01-15 14:56:59
 * @LastEditors: xuning 453594138@qq.com
 * @LastEditTime: 2024-03-11 18:41:30
 * @FilePath: \spx-gui\src\components\spx-stage\SpxStage.vue
 * @Description:
-->
<template>
  <div ref="spxStage" class="spx-stage">
    <div class="stage-button">{{ $t('component.stage') }}</div>
    <n-button v-if="show" type="error" @click="stop">{{ $t('stage.stop') }}</n-button>
    <n-button v-else type="success" @click="run">{{ $t('stage.run') }}</n-button>
    <div v-if="show" class="stage-runner">
      <ProjectRunner ref="projectRunner" :project="project" />
    </div>
    <div v-else class="stage-viewer-container">
      <!-- When the mount is not complete, use the default value to prevent errors during component initialization -->
      <StageViewer
        :width="containerWidth || 400"
        :height="containerHeight || 400"
        :selected-sprite-names="selectedSpriteNames"
        :project="project"
        @on-selected-sprites-change="onSelectedSpritesChange"
      ></StageViewer>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import { useSize } from '@/utils/dom'
import { NButton } from 'naive-ui'
import { useProjectStore } from '@/stores'
import ProjectRunner from '@/components/project-runner/ProjectRunner.vue'
import { nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import StageViewer from './stage-viewer'
import type { SelectedSpritesChangeEvent } from './stage-viewer'

let show = ref(false)

const projectStore = useProjectStore()
const editorStore = useEditorStore()

const project = computed(() => projectStore.project)
const spxStage = ref<HTMLElement | null>(null)
const { width: containerWidth, height: containerHeight } = useSize(spxStage)

const selectedSpriteNames = ref<string[]>([])

const onSelectedSpritesChange = (e: SelectedSpritesChangeEvent) => {
  selectedSpriteNames.value = e.names
  editorStore.select('sprite', e.names[0])
}

const projectRunner = ref<InstanceType<typeof ProjectRunner> | null>(null)

const run = async () => {
  show.value = true
  // As we just changed show to mount the ProjectRunner,
  // we need to wait for the next tick to ensure the ProjectRunner is mounted.
  await nextTick()
  if (!projectRunner.value) {
    throw new Error('ProjectRunner is not mounted')
  }
  projectRunner.value.run()
}

const stop = async () => {
  show.value = false
  projectRunner.value?.stop()
}

watch(
  () => editorStore.selectedSprite,
  () => {
    if (editorStore.selectedSprite) {
      selectedSpriteNames.value = [editorStore.selectedSprite.name]
    } else {
      selectedSpriteNames.value = []
    }
  }
)
</script>

<style scoped lang="scss">
.spx-stage {
  height: 40vh;
  display: flex;
  flex-direction: column;
  border: 2px solid #00142970;
  position: relative;
  background: white;
  border-radius: 24px;
  margin: 10px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  .stage-button {
    background: rgba(90, 196, 236, 0.4);
    width: 80px;
    height: auto;
    text-align: center;
    position: absolute;
    top: -2px;
    left: 8px;
    font-size: 18px;
    border: 2px solid #00142970;
    border-radius: 0 0 10px 10px;
    z-index: 2;
  }

  .n-button {
    position: absolute;
    right: 6px;
    top: 2px;
    border: 2px solid #00142970;
    border-radius: 16px;
    z-index: 100;
  }

  .show {
    flex: 1;
    text-align: center;
  }

  .center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stage-viewer-container {
    display: flex;
    justify-content: center;
  }

  .stage-runner {
    display: flex;
    height: 100%;
  }
}
</style>
