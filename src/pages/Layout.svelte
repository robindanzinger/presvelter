<script>
import Rect from './Rect.svelte'
</script>

<div class="container">
<Rect bgcolor="orange"/>
<Rect bgcolor="green"/>
<Rect bgcolor="blue"/>
<Rect bgcolor="red"/>
<Rect bgcolor="lightblue"/>
<Rect bgcolor="lightgrey"/>
</div>

<div class="grid-container">
<Rect bgcolor="orange"/>
<Rect bgcolor="green"/>
<Rect bgcolor="blue"/>
<Rect bgcolor="red"/>
<Rect bgcolor="lightblue"/>
<Rect bgcolor="lightgrey"/>
</div>
<style>
  .container {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 80px;
  }
  .grid-container {
    width: 100%;
    display: grid;
    grid-template-columns: 200px 300px auto;
    grid-template-rows: 160px 140px;
    grid-gap: 40px;
  }
</style>
