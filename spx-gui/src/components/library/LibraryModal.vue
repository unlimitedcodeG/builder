<!--
 * @Author: Xu Ning
 * @Date: 2024-01-17 22:51:52
 * @LastEditors: xuning 453594138@qq.com
 * @LastEditTime: 2024-03-14 10:50:52
 * @FilePath: /builder/spx-gui/src/components/spx-library/LibraryModal.vue
 * @Description:
-->
<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    content-style="max-height:70vh;overflow:scroll;"
    :on-after-leave="closeModalFunc"
  >
    <!-- S Library Header -->
    <template #header>
      <div class="header-container">
        <n-input
          v-model:value="searchQuery"
          size="large"
          :placeholder="$t('library.search')"
          clearable
          round
          @keypress.enter="handleSearch"
        />
      </div>
    </template>
    <!-- E Library Header -->

    <template #default>
      <!-- S Library Sub Header -->
      <div class="asset-library-sub-header">
        <n-flex>
          <n-button
            v-for="category in categories"
            :key="category"
            size="large"
            @click="handleCategoryClick(category)"
          >
            {{ category }}
          </n-button>
          <span class="sort-btn">
            <n-button size="large" circle @click="handleSortByHot">
              <template #icon>
                <n-icon><hotIcon /></n-icon>
              </template>
            </n-button>
            <n-button size="large" circle class="sort-btn-new" @click="handleSortByTime">
              <template #icon>
                <n-icon><newIcon /></n-icon>
              </template>
            </n-button>
          </span>
        </n-flex>
      </div>
      <!-- E Library Sub Header -->
      <!-- S Library Content -->
      <div class="asset-library-content">
        <n-switch
          v-model:value="isPublicSwitch"
          :checked-value="UIPublic.public"
          :unchecked-value="UIPublic.private"
          style="width: 130px; float: right; margin: 10px 0 0 0"
          :rail-style="railStyle"
          @update:value="handleAssetLibraryOption"
        >
          <template #checked> {{ $t('library.public') }} </template>
          <template #unchecked> {{ $t('library.private') }} </template>
        </n-switch>
        <div v-if="assetInfos != null && assetInfos.length != 0">
          <n-grid
            v-if="assetInfos != null && assetInfos.length != 0"
            cols="3 s:4 m:5 l:6 xl:7 2xl:8"
            responsive="screen"
          >
            <n-grid-item v-for="assetInfo in assetInfos" :key="assetInfo.id">
              <div class="asset-library-sprite-item">
                <!-- S Component Sprite Card -->
                <SpriteCard :asset-info="assetInfo" @add-asset="handleAddAsset" />
                <!-- S Component Sprite Card -->
              </div>
            </n-grid-item>
          </n-grid>
          <div style="text-align: center; margin-top: 16px">
            <n-pagination
              v-model:page="pageIndex"
              :page-count="totalPage"
              simple
              style="width: 160px; margin: auto"
            />
          </div>
        </div>

        <n-empty
          v-else
          class="n-empty-style"
          :show-icon="false"
          size="large"
          :description="$t('library.empty')"
        />
      </div>
      <!-- E Library Content -->
    </template>
  </n-modal>
</template>

<script lang="ts" setup>
import { defineEmits, defineProps, ref, watch, onMounted } from 'vue'
import type { CSSProperties } from 'vue'
import {
  NModal,
  NButton,
  NFlex,
  NGrid,
  NGridItem,
  NInput,
  NIcon,
  NEmpty,
  NSwitch,
  NPagination
} from 'naive-ui'
import { FireFilled as hotIcon } from '@vicons/antd'
import { NewReleasesFilled as newIcon } from '@vicons/material'
import SpriteCard from './SpriteCard.vue'
import {
  listAsset,
  increaseAssetClickCount,
  type AssetData,
  AssetType,
  IsPublic,
  ListAssetParamOrderBy
} from '@/apis/asset'

// ----------props & emit------------------------------------
interface PropsType {
  show: boolean
  type: AssetType
}
const props = defineProps<PropsType>()
const emits = defineEmits<{
  'update:show': [boolean]
  'add-asset': [AssetData]
}>()

// ----------data related -----------------------------------
const railStyle = ({ focused, checked }: { focused: boolean; checked: boolean }) => {
  const style: CSSProperties = {}
  if (checked) {
    style.background = '#d03050'
    if (focused) {
      style.boxShadow = '0 0 0 2px #d0305040'
    }
  } else {
    style.background = '#2080f0'
    if (focused) {
      style.boxShadow = '0 0 0 2px #2080f040'
    }
  }
  return style
}
// Ref about show modal state.
const showModal = ref<boolean>(false)
// Ref about search text.
const searchQuery = ref('')
// Const variable about sprite categories.
const categories = ['ALL', 'Animals', 'People', 'Sports', 'Food', 'Fantasy']
// Ref about sprite/backdrop information.
const assetInfos = ref<AssetData[] | null>()
// Ref about now asset category
const nowCategory = ref<string>('')
// asset states (public or not)
const isPublicSwitch = ref<number>(0)
// constant pageSize
const pageSize = 35
const pageIndex = ref<number>(1)
const totalPage = ref<number>(0)

// ----------methods-----------------------------------------

/**
 * @description: A function to set asset from backend by props.type.
 * @param {*} assetType
 * @Author: Yao xinyue
 * @Date: 2024-03-05 15:10:45
 */
const setAssets = async () => {
  if (props.type === AssetType.Backdrop) {
    assetInfos.value = await fetchAssetsByType(AssetType.Backdrop)
  } else if (props.type === AssetType.Sprite) {
    assetInfos.value = await fetchAssetsByType(AssetType.Sprite)
  }
}

// Control the public/private state of user interface elements
enum UIPublic {
  private = 0,
  public = 1
}

/**
 * @description: A function to fetch asset from backend by getAssetList.
 * @param {*} assetType
 * @Author: Xu Ning
 * @Date: 2024-01-25 23:50:45
 */
const fetchAssetsByType = async (assetType: AssetType, orderBy?: ListAssetParamOrderBy) => {
  try {
    let isPublic: IsPublic | undefined
    let owner: string | undefined
    if (isPublicSwitch.value == UIPublic.public) {
      isPublic = IsPublic.public
      owner = '*'
    }
    const { total, data } = await listAsset({
      isPublic: isPublic,
      pageIndex: pageIndex.value,
      pageSize: pageSize,
      assetType: assetType,
      category: nowCategory.value,
      orderBy,
      owner
    })
    totalPage.value = Math.ceil(total / pageSize)
    return data
  } catch (error) {
    console.error('Error fetching assets:', error)
    return []
  }
}

/**
 * @description: Watch the state of show.
 * @Author: Xu Ning
 * @Date: 2024-01-17 23:42:44
 */
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      showModal.value = newShow
      setAssets()
    } else {
      isPublicSwitch.value = UIPublic.public
    }
  }
)

/**
 * @description: A function about closing modal.
 * @Author: Xu Ning
 * @Date: 2024-01-17 23:42:57
 */
const closeModalFunc = () => {
  emits('update:show', false)
}

const handleAddAsset = async (asset: AssetData) => {
  await increaseAssetClickCount(asset.id)
  emits('add-asset', asset)
}

/**
 * @description: A function to search assets by type.
 * @param {*} category - asset type.
 * @return {*}
 * @Author: Xu Ning
 * @Date: 2024-02-06 13:47:05
 */
const handleCategoryClick = async (category: string) => {
  if (category == 'ALL') {
    category = ''
  }
  nowCategory.value = category
  await setAssets()
}

/**
 * @description: A function to handle search logic.
 * @return {*}
 * @Author: Xu Ning
 * @Date: 2024-02-06 17:09:03
 */
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  const { total, data } = await listAsset({
    pageIndex: pageIndex.value,
    pageSize,
    assetType: props.type,
    keyword: searchQuery.value
  })
  totalPage.value = Math.ceil(total / pageSize)
  assetInfos.value = data
}

/**
 * @description: A function to handle sort by hot.
 * @return {*}
 * @Author: Xu Ning
 * @Date: 2024-02-19 9:09:05
 */
const handleSortByHot = async () => {
  assetInfos.value = await fetchAssetsByType(props.type, ListAssetParamOrderBy.ClickCountDesc)
}

/**
 * @description: A function to handle sort by time.
 * @return {*}
 * @Author: Xu Ning
 * @Date: 2024-02-19 9:19:01
 */
const handleSortByTime = async () => {
  assetInfos.value = await fetchAssetsByType(props.type, ListAssetParamOrderBy.TimeDesc)
}

// clean search content and pageIndex state
const handleAssetLibraryOption = () => {
  searchQuery.value = ''
  nowCategory.value = ''
  pageIndex.value = 1
}

/**
 * @description: Reset assets
 * @return {*}
 * @Author: Yao xinyue
 * @Date: 2024-03-05 15:01:45
 */
watch(isPublicSwitch, async () => {
  pageIndex.value = 1
  await setAssets()
})

// Distinguish between page turning after search or normal page turning.
watch(pageIndex, async () => {
  searchQuery.value == '' ? await setAssets() : await handleSearch()
})

// Used to restore material display when the search value is deleted to empty.
watch(searchQuery, async () => {
  if (searchQuery.value == '') setAssets()
})
</script>

<style lang="scss">
@import '@/assets/theme.scss';
.asset-library-sub-header {
  background: $asset-library-card-title-2;
  padding: 10px 24px;
  position: absolute;
  width: calc(100% - 48px);
  z-index: 100;
  .sort-btn {
    position: absolute;
    right: 24px;
    .sort-btn-new {
      margin-left: 4px;
    }
  }
}

.asset-library-content {
  margin: 60px 0 20px 0;
  min-height: 300px;
  .n-empty-style {
    min-height: 300px;
    line-height: 300px;
    .n-empty__description {
      line-height: 300px;
    }
  }
}
.asset-library-sprite-item {
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-container {
  display: flex;
  align-items: center;
  width: 50%;
  margin: auto;
  flex-direction: row;
  .search-input {
    width: 50%;
  }
}
</style>
